import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".temp"]);
const ignoredFiles = new Set(["package-lock.json"]);
const patterns = [
  /service[_-]?role[_-]?key/i,
  /supabase[_-]?service/i,
  /private[_-]?key/i,
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /sk-[A-Za-z0-9]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const findings = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      findings.push(...(await walk(path)));
      continue;
    }

    if (!entry.isFile() || ignoredFiles.has(entry.name)) {
      continue;
    }

    const content = await readFile(path, "utf8").catch(() => "");
    const matched = patterns.some((pattern) => pattern.test(content));
    if (matched) {
      findings.push(path.replace(`${root}\\`, ""));
    }
  }

  return findings;
}

const findings = await walk(root);

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("No obvious secrets detected.");
