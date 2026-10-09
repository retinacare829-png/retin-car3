// Run with node --test; intentionally excluded from Vitest's *.test.* discovery.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, open, rm, symlink, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createDemoServer, parseOptions } from "./serve-demo.mjs";

const script = fileURLToPath(new URL("./serve-demo.mjs", import.meta.url));
const marker = "SYNTHETIC-PRIVATE-MARKER";

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "retinacare-http-test-"));
  t.after(async () => {
    // Delete only the directory created by this test, never a supplied build root.
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("retinacare-http-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  const rootDir = join(directory, "dist-demo");
  await mkdir(join(rootDir, "assets"), { recursive: true });
  await mkdir(join(rootDir, "models"), { recursive: true });
  await mkdir(join(directory, "outside"));
  const files = {
    "index.html": "<!doctype html><title>RetinaCare fixture</title>",
    "assets/app.js": "export const demo = true;",
    "assets/app.css": "body { color: teal; }",
    "assets/retina.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "assets/font.ttf": Buffer.from([0, 1, 2, 3]),
    "assets/OFL.txt": "Fixture license",
    "models/model.json": '{"modelTopology":{}}',
    "models/weights.bin": Buffer.from([0, 255, 128, 1]),
    "manifest.webmanifest": '{"name":"Demo"}',
    "assets/app.js.map": marker,
    "assets/.env": marker,
    "assets/package.json": marker,
    "assets/patient-record.sql": marker,
    "assets/hello world.txt": "Hello",
  };
  for (const [path, data] of Object.entries(files)) await writeFile(join(rootDir, path), data);
  await writeFile(join(directory, "outside", "private.txt"), marker);
  await mkdir(join(rootDir, "folder.html"));
  const logs = [];
  const server = await createDemoServer({ rootDir, log: (entry) => logs.push(entry), ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const closed = new Promise((done) => server.close(done));
    server.closeAllConnections();
    await closed;
  });
  return { directory, rootDir, server, port: server.address().port, logs, files };
}

function http(port, path = "/", { method = "GET", headers = {}, body } = {}) {
  return new Promise((done, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), aborted: false }));
      res.on("error", () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), aborted: true }));
    });
    req.setTimeout(3_000, () => req.destroy(new Error("test request timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

function raw(port, packet) {
  return new Promise((done, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const chunks = [];
    socket.on("connect", () => socket.write(packet));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => done(Buffer.concat(chunks).toString()));
    socket.on("error", reject);
    socket.setTimeout(3_000, () => socket.destroy(new Error("test socket timeout")));
  });
}

test("serves the build, binary model, fonts and manifest with correct MIME and HEAD semantics", async (t) => {
  const f = await fixture(t);
  for (const [path, type] of [
    ["/", "text/html"], ["/assets/app.js", "text/javascript"],
    ["/assets/app.css", "text/css"], ["/assets/retina.svg", "image/svg+xml"],
    ["/assets/font.ttf", "font/ttf"], ["/assets/OFL.txt", "text/plain"],
    ["/models/model.json", "application/json"], ["/models/weights.bin", "application/octet-stream"],
    ["/manifest.webmanifest", "application/manifest+json"], ["/assets/hello%20world.txt", "text/plain"],
  ]) {
    const res = await http(f.port, path);
    assert.equal(res.status, 200, path);
    assert.ok(res.headers["content-type"].startsWith(type));
    assert.equal(res.headers["content-length"], String(res.body.length));
    assert.equal(res.headers["cache-control"], "no-cache");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["referrer-policy"], "no-referrer");
    assert.equal(res.headers["x-frame-options"], "DENY");
    const expected = f.files[path === "/" ? "index.html" : decodeURIComponent(path.slice(1))];
    assert.deepEqual(res.body, Buffer.from(expected));
    const head = await http(f.port, path, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(head.headers["content-length"], res.headers["content-length"]);
  }
});

test("health is a static-process check; missing routes, directories and private files are actual 404s", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(JSON.parse((await http(f.port, "/healthz")).body), { status: "ok" });
  for (const path of ["/missing", "/missing.js", "/assets", "/assets/", "/folder.html", "/patients/123",
    "/.env", "/.git/config", "/assets/.env", "/assets/app.js.map", "/assets/package.json", "/assets/patient-record.sql"]) {
    const res = await http(f.port, path);
    assert.equal(res.status, 404, path);
    assert.equal(JSON.parse(res.body).error, "NOT_FOUND");
    assert.equal(res.headers["cache-control"], "no-store");
    assert.ok(!res.body.includes(marker));
    assert.ok(!res.body.includes(path));
  }
  const head = await http(f.port, "/missing", { method: "HEAD" });
  assert.equal(head.status, 404);
  assert.equal(head.body.length, 0);
});

test("rejects raw, encoded, double-encoded and Windows traversal before normalization", async (t) => {
  const f = await fixture(t);
  for (const path of ["/../outside/private.txt", "/assets/../../outside/private.txt", "/%2e%2e/outside/private.txt",
    "/assets/%2E%2E/%2e%2e/outside/private.txt", "/%252e%252e/outside/private.txt",
    "/assets%2f..%2fprivate.txt", "/%5c..%5cprivate.txt", "/..\\outside\\private.txt",
    "//outside/private.txt", "/C:/private.txt", "/assets/app.js::$DATA", "/assets/app.js.",
    "/assets/app.js%20", "/NUL.txt", "/COM1", "/LPT9.txt", "/%00", "/%0a", "/%7f",
    "/%", "/%ZZ", "/%E0%A4%A", "/index.html#private", "http://example.invalid/index.html"]) {
    const res = await http(f.port, path);
    assert.equal(res.status, 400, path);
    assert.equal(JSON.parse(res.body).error, "BAD_REQUEST");
    assert.ok(!res.body.includes(marker));
  }
  assert.equal((await http(f.port, `/${"a".repeat(4096)}`)).status, 414);
  assert.equal((await http(f.port)).status, 200);
});

test("blocks symlink/junction escapes and internal directory links", async (t) => {
  const f = await fixture(t);
  const type = process.platform === "win32" ? "junction" : "dir";
  await symlink(join(f.directory, "outside"), join(f.rootDir, "escape"), type);
  await symlink(join(f.rootDir, "assets"), join(f.rootDir, "alias"), type);
  assert.equal((await http(f.port, "/escape/private.txt")).status, 404);
  assert.equal((await http(f.port, "/alias/app.js")).status, 404);
});

test("unsupported methods and request bodies fail closed", async (t) => {
  const f = await fixture(t);
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PROPFIND"]) {
    const res = await http(f.port, "/", { method, headers: { "Content-Length": String(marker.length) }, body: marker });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.allow, "GET, HEAD");
    assert.equal(res.headers.connection, "close");
  }
  const res = await http(f.port, "/", { headers: { "Content-Length": String(marker.length) }, body: marker });
  assert.equal(res.status, 400);
  const chunked = await raw(f.port, "GET / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n");
  assert.match(chunked, /^HTTP\/1\.1 400 /);
});

test("malformed framing, large headers, expectations, CONNECT and upgrades are controlled and logged", async (t) => {
  const f = await fixture(t);
  const cases = [
    [`GET / HTTP/1.1\r\nHost: ${marker}\r\nInvalid Header: ${marker}\r\n\r\n`, 400],
    ["GET / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 1\r\nContent-Length: 2\r\n\r\n", 400],
    [`GET / HTTP/1.1\r\nHost: localhost\r\nCookie: ${"x".repeat(17000)}\r\n\r\n`, 431],
    ["POST / HTTP/1.1\r\nHost: localhost\r\nExpect: 100-continue\r\nContent-Length: 999\r\n\r\n", 417],
    ["GET / HTTP/1.1\r\nHost: localhost\r\nExpect: other\r\n\r\n", 417],
    [`CONNECT ${marker}:443 HTTP/1.1\r\nHost: localhost\r\n\r\n`, 405],
    ["GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n", 400],
  ];
  for (const [packet, status] of cases) {
    const res = await raw(f.port, packet);
    assert.ok(res.startsWith(`HTTP/1.1 ${status} `));
    assert.ok(!res.includes(marker));
    assert.match(res, /X-Request-Id: [a-f0-9-]+/i);
  }
  assert.equal(f.logs.length, cases.length);
  assert.ok(!JSON.stringify(f.logs).includes(marker));
  assert.equal((await http(f.port)).status, 200);
});

test("request IDs correlate errors without logging paths, queries, headers, bodies, addresses or arbitrary methods", async (t) => {
  const f = await fixture(t);
  const headers = {
    Authorization: `Bearer ${marker}`, Cookie: `session=${marker}`, Referer: `https://example.invalid/${marker}`,
    "User-Agent": marker, "X-Request-Id": marker, "X-Forwarded-For": "192.0.2.123",
  };
  await http(f.port, `/?token=${marker}&patient=${marker}`, { headers });
  const res = await http(f.port, `/${marker}.txt?token=${marker}`, { headers });
  await http(f.port, "/", { method: "PROPFIND", headers, body: marker });
  const logged = f.logs.find((entry) => entry.requestId === res.headers["x-request-id"]);
  assert.equal(logged.status, 404);
  assert.equal(logged.requestId, JSON.parse(res.body).requestId);
  assert.notEqual(logged.requestId, marker);
  const serialized = JSON.stringify(f.logs);
  for (const secret of [marker, "token=", "patient=", "Authorization", "Cookie", "Referer", "192.0.2.123", "PROPFIND", f.rootDir]) {
    assert.ok(!serialized.includes(secret), `Unexpected log field/value: ${secret}`);
  }
  const allowedKeys = ["timestamp", "event", "level", "requestId", "method", "route", "status", "code", "durationMs"].sort();
  for (const entry of f.logs) assert.deepEqual(Object.keys(entry).sort(), allowedKeys);
  assert.equal(new Set(f.logs.map((entry) => entry.requestId)).size, 3);
});

test("unexpected disk errors return a sanitized 500 and the next request still succeeds", async (t) => {
  let broken = true;
  const f = await fixture(t, { openFile: (...args) => {
    if (broken) { broken = false; throw Object.assign(new Error(marker), { code: "EIO" }); }
    return open(...args);
  } });
  const res = await http(f.port, "/");
  assert.equal(res.status, 500);
  assert.equal(JSON.parse(res.body).error, "INTERNAL_ERROR");
  assert.ok(!res.body.includes(marker));
  assert.ok(!JSON.stringify(f.logs).includes(marker));
  assert.equal(f.logs[0].level, "error");
  assert.equal((await http(f.port)).status, 200);
});

test("a mid-stream disk failure aborts the response and emits a safe error event", async (t) => {
  const f = await fixture(t, { openFile: async (...args) => {
    const handle = await open(...args);
    return {
      stat: () => handle.stat(), close: () => handle.close(),
      createReadStream: () => {
        let started = false;
        return new Readable({ read() {
          if (started) return;
          started = true;
          this.push("<!doctype");
          setImmediate(() => this.destroy(new Error(marker)));
        } });
      },
    };
  } });
  const res = await http(f.port);
  assert.equal(res.aborted, true);
  assert.equal(f.logs[0].status, 500);
  assert.equal(f.logs[0].code, "FILE_READ_FAILED");
  assert.ok(!JSON.stringify(f.logs).includes(marker));
  assert.equal((await http(f.port, "/healthz")).status, 200);
});

test("a broken log sink does not stop serving requests", async (t) => {
  const f = await fixture(t, { log: () => { throw new Error(marker); } });
  assert.equal((await http(f.port)).status, 200);
  assert.equal((await http(f.port, "/missing")).status, 404);
});

test("slow incomplete headers time out with a controlled 408", { timeout: 5_000 }, async (t) => {
  const f = await fixture(t);
  // Shorten only this test's deadlines; the production scan interval is 1 s.
  f.server.headersTimeout = 50;
  f.server.requestTimeout = 100;
  const res = await raw(f.port, `GET / HTTP/1.1\r\nHost: ${marker}\r\n`);
  assert.match(res, /^HTTP\/1\.1 408 /);
  assert.equal(f.logs[0].code, "REQUEST_TIMEOUT");
  assert.ok(!JSON.stringify(f.logs).includes(marker));
  assert.equal((await http(f.port)).status, 200);
});

test("client disconnect during a transfer is contained and logged without an unhandled error", { timeout: 5_000 }, async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.rootDir, "assets", "large.bin"), Buffer.alloc(8 * 1024 * 1024));
  const socket = createConnection({ host: "127.0.0.1", port: f.port });
  const closed = once(socket, "close");
  socket.on("connect", () => socket.write("GET /assets/large.bin HTTP/1.1\r\nHost: localhost\r\n\r\n"));
  socket.once("data", () => socket.destroy());
  await closed;
  assert.equal((await http(f.port, "/healthz")).status, 200);
  assert.ok(f.logs.some((entry) => entry.status === 499 && entry.code === "CLIENT_DISCONNECTED"));
});

test("startup refuses missing builds, source directories and an index symlink/junction", async (t) => {
  const f = await fixture(t);
  await assert.rejects(createDemoServer({ rootDir: join(f.directory, "missing") }), /BUILD_NOT_READY/);
  await writeFile(join(f.rootDir, "package.json"), "{}");
  await assert.rejects(createDemoServer({ rootDir: f.rootDir }), /BUILD_NOT_READY/);
  await rm(join(f.rootDir, "package.json"));
  await rm(join(f.rootDir, "index.html"));
  await symlink(join(f.directory, "outside"), join(f.rootDir, "index.html"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createDemoServer({ rootDir: f.rootDir }), /BUILD_NOT_READY/);
});

async function cli(args, env = {}) {
  const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env }, windowsHide: true });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const [code] = await once(child, "close");
  return { code, output };
}

test("CLI validates configuration without echoing bad arguments, paths or listen errors", async (t) => {
  const f = await fixture(t);
  for (const args of [["--port", marker], ["--port", "65536"], ["--port"], ["--unknown", marker],
    ["--port", "1", "--port", "2"], ["--root", join(f.directory, marker)],
    ["--root", f.rootDir, "--host", "127.0.0.1", "--port", String(f.port)]]) {
    const result = await cli(args, { HOST: "127.0.0.1", PORT: "4173" });
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.output).event, "startup_error");
    assert.ok(!result.output.includes(marker));
    assert.ok(!result.output.includes(f.directory));
    assert.ok(!result.output.includes("Error:"));
  }
  const options = parseOptions(["--port", "0", "--host", "127.0.0.1"], { PORT: "8080", HOST: "0.0.0.0" });
  assert.equal(options.port, 0);
  assert.equal(options.host, "127.0.0.1");
  assert.equal(parseOptions([], {}).host, "127.0.0.1");
  assert.equal(parseOptions([], { PORT: "8080" }).port, 8080);
  assert.ok(parseOptions([], {}).rootDir.endsWith(`${process.platform === "win32" ? "\\" : "/"}dist-demo`));
});
