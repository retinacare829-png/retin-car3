#!/usr/bin/env node
// Serve a trusted, immutable build directory; never use this as an upload server.
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { createServer, STATUS_CODES } from "node:http";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../dist-demo");
const MIME = new Map(Object.entries({
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8", ".bin": "application/octet-stream",
  ".wasm": "application/wasm",
}));
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};
const ERROR_CODES = {
  400: "BAD_REQUEST", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED",
  408: "REQUEST_TIMEOUT", 414: "URI_TOO_LONG", 417: "EXPECTATION_FAILED",
  431: "HEADERS_TOO_LARGE", 500: "INTERNAL_ERROR",
};

function failure(status) {
  return Object.assign(new Error(ERROR_CODES[status]), { status });
}

export function writeLog(entry) {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

// Only server-owned enums, generated IDs, timestamps and numbers reach this sink.
// In particular, never add req.url, headers, IPs, raw packets or Error objects.
function audit(log, entry) {
  try { log({ timestamp: new Date().toISOString(), ...entry }); } catch {
    // A failing log consumer must not create an unhandled request exception.
  }
}

function inside(root, target) {
  const path = relative(root, target);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function parseTarget(target) {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) throw failure(400);
  if (target.length > 4096) throw failure(414);
  // Validate BEFORE URL/path normalization could erase traversal segments.
  const rawPath = target.split("?", 1)[0];
  if (/%(?:2f|5c)/i.test(rawPath) || target.includes("#")) throw failure(400);
  let path;
  try { path = decodeURIComponent(rawPath); } catch { throw failure(400); }
  if (/[\\%\x00-\x1f\x7f<>:"|?*]/u.test(path)) throw failure(400);
  const parts = path.slice(1).split("/");
  if (parts.some((part) => part === "." || part === ".." || /[. ]$/.test(part)
    || /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(part))) throw failure(400);
  if (parts.some((part) => part.startsWith(".") || /^(?:node_modules|package(?:-lock)?\.json|tsconfig.*\.json)$/i.test(part))) throw failure(404);
  if (path === "/") return { parts: ["index.html"], route: "document" };
  if (path === "/healthz") return { parts: [], route: "health" };
  if (parts.some((part) => !part) || !MIME.has(extname(path).toLowerCase())) throw failure(404);
  return { parts, route: path === "/index.html" ? "document" : "asset" };
}

async function checkedPath(root, parts) {
  let candidate = root;
  for (let i = 0; i < parts.length; i += 1) {
    candidate = resolve(candidate, parts[i]);
    if (!inside(root, candidate)) throw failure(404);
    const stat = await lstat(candidate);
    // Reject file symlinks and directory junctions, including links within root.
    if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw failure(404);
  }
  if (!inside(root, await realpath(candidate))) throw failure(404);
  return candidate;
}

function statusFor(error) {
  if (error?.status && ERROR_CODES[error.status]) return error.status;
  if (["ENOENT", "ENOTDIR", "EACCES", "EPERM", "ELOOP"].includes(error?.code)) return 404;
  return 500;
}

function jsonResponse(req, res, status, body) {
  const data = `${JSON.stringify(body)}\n`;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data), "Cache-Control": "no-store",
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

// openFile is injectable to test I/O failures without platform-specific chmod.
export async function createDemoServer({ rootDir = DEFAULT_ROOT, log = writeLog, openFile = open } = {}) {
  let root;
  try {
    root = await realpath(resolve(rootDir));
    for (const marker of [".git", "package.json", "node_modules", ".env", ".env.staging"]) {
      try { await lstat(resolve(root, marker)); } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      throw failure(404); // Refuse an obvious source tree or environment directory.
    }
    const index = await checkedPath(root, ["index.html"]);
    const handle = await open(index, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try { if (!(await handle.stat()).isFile()) throw failure(404); } finally { await handle.close(); }
  } catch {
    throw new Error("BUILD_NOT_READY");
  }

  const responses = new WeakMap();
  async function handleRequest(req, res, forcedStatus) {
    responses.set(req.socket, res);
    const started = performance.now();
    const requestId = randomUUID();
    const method = ["GET", "HEAD"].includes(req.method) ? req.method : "OTHER";
    let route = "rejected", code = "OK", errorStatus, logged = false;
    const record = () => {
      if (logged) return;
      logged = true;
      const status = errorStatus ?? (res.writableFinished ? res.statusCode : 499);
      audit(log, {
        event: "request", level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        requestId, method, route, status,
        code: status === 499 ? "CLIENT_DISCONNECTED" : code,
        durationMs: Math.round(performance.now() - started),
      });
    };
    res.once("finish", record);
    res.once("close", record);
    req.on("error", () => res.destroy());
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    res.setHeader("X-Request-Id", requestId);

    let handle;
    try {
      if (forcedStatus) throw failure(forcedStatus);
      if (method === "OTHER") throw failure(405);
      if (req.headers["transfer-encoding"] !== undefined
        || (req.headers["content-length"] !== undefined && req.headers["content-length"] !== "0")) throw failure(400);
      const target = parseTarget(req.url);
      route = target.route;
      if (route === "health") {
        jsonResponse(req, res, 200, { status: "ok" });
        return;
      }
      const path = await checkedPath(root, target.parts);
      handle = await openFile(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const stat = await handle.stat();
      if (!stat.isFile()) throw failure(404);
      if (res.destroyed) return;
      res.setHeader("Content-Type", MIME.get(extname(path).toLowerCase()));
      res.setHeader("Content-Length", stat.size);
      // Revalidate models and HTML together; filenames are not all content-hashed.
      res.setHeader("Cache-Control", "no-cache");
      if (method === "HEAD") {
        res.end();
        return;
      }
      const stream = handle.createReadStream({ autoClose: false });
      stream.once("error", (error) => {
        if (!["ERR_STREAM_PREMATURE_CLOSE", "ABORT_ERR"].includes(error.code)) {
          code = "FILE_READ_FAILED";
          errorStatus = 500;
        }
        record();
      });
      await pipeline(stream, res);
    } catch (error) {
      const status = statusFor(error);
      if (res.destroyed || res.headersSent) {
        res.destroy();
        return;
      }
      code = ERROR_CODES[status];
      res.setHeader("Connection", "close");
      if (status === 405) res.setHeader("Allow", "GET, HEAD");
      jsonResponse(req, res, status, { error: code, requestId });
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }

  const server = createServer({
    maxHeaderSize: 16 * 1024, headersTimeout: 10_000,
    requestTimeout: 15_000, keepAliveTimeout: 5_000,
    connectionsCheckingInterval: 1_000,
  }, (req, res) => { void handleRequest(req, res); });

  const rejectedSockets = new WeakSet();
  function rejectSocket(socket, status, method = "OTHER") {
    if (rejectedSockets.has(socket)) return;
    rejectedSockets.add(socket);
    const requestId = randomUUID();
    audit(log, { event: "protocol_error", level: "warn", requestId, method,
      route: "rejected", status, code: ERROR_CODES[status] });
    if (!socket.writable || socket.destroyed) return;
    const body = `${JSON.stringify({ error: ERROR_CODES[status], requestId })}\n`;
    const headers = {
      ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body),
      "X-Request-Id": requestId, Connection: "close",
      ...(status === 405 ? { Allow: "GET, HEAD" } : {}),
    };
    socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join("")}\r\n${body}`);
    // Upgraded sockets are outside closeAllConnections; do not retain them.
    const timer = setTimeout(() => socket.destroy(), 1_000).unref();
    socket.once("close", () => clearTimeout(timer));
  }
  server.on("clientError", (error, socket) => {
    if (error.code === "ECONNRESET") return socket.destroy();
    const response = responses.get(socket);
    // Stream failures also surface here. Never append a second HTTP response to
    // an active response or a connection that has already been marked closed.
    if (response && (!response.writableFinished || !response.shouldKeepAlive)) return socket.destroy();
    rejectSocket(socket, error.code === "HPE_HEADER_OVERFLOW" ? 431
      : error.code === "ERR_HTTP_REQUEST_TIMEOUT" ? 408 : 400);
  });
  server.on("connect", (_req, socket) => rejectSocket(socket, 405));
  server.on("upgrade", (_req, socket) => rejectSocket(socket, 400));
  server.on("checkContinue", (req, res) => { void handleRequest(req, res, 417); });
  server.on("checkExpectation", (req, res) => { void handleRequest(req, res, 417); });
  server.setTimeout(30_000, (socket) => socket.destroy());
  return server;
}

export function parseOptions(args, env = process.env) {
  const options = { rootDir: DEFAULT_ROOT, host: env.HOST || "127.0.0.1", port: env.PORT || "4173" };
  const flags = new Map([["--root", "rootDir"], ["--host", "host"], ["--port", "port"]]);
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!flags.has(flag) || seen.has(flag) || !value || value.startsWith("--")) throw new Error("INVALID_OPTIONS");
    seen.add(flag);
    options[flags.get(flag)] = value;
  }
  if (!/^\d{1,5}$/.test(String(options.port)) || Number(options.port) > 65535) throw new Error("INVALID_OPTIONS");
  options.port = Number(options.port);
  return options;
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    process.stdout.write("Usage: node scripts/serve-demo.mjs [--host 127.0.0.1] [--port 4173] [--root dist-demo]\nHOST and PORT are supported; flags take precedence. Root defaults to the repository's dist-demo.\n");
    return;
  }
  let server;
  try {
    const options = parseOptions(process.argv.slice(2));
    server = await createDemoServer(options);
    await new Promise((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, () => {
        server.off("error", reject);
        resolveListen();
      });
    });
  } catch (error) {
    audit(writeLog, { event: "startup_error", level: "error",
      code: ["INVALID_OPTIONS", "BUILD_NOT_READY"].includes(error.message) ? error.message : "LISTEN_FAILED" });
    process.exitCode = 1;
    return;
  }
  audit(writeLog, { event: "listening", level: "info", port: server.address().port });
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => server.closeAllConnections(), 10_000).unref();
    server.close(() => {
      clearTimeout(timer);
      audit(writeLog, { event: "stopped", level: "info" });
    });
  }
  server.on("error", () => {
    audit(writeLog, { event: "server_error", level: "error", code: "SERVER_ERROR" });
    process.exitCode = 1;
    stop();
  });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
