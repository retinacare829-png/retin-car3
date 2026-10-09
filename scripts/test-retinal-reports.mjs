import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Deliberately local-only: no URLs, environment files, passwords, or API keys.
const sql = readFileSync(new URL("../supabase/tests/retinal_analysis_reports_qa.sql", import.meta.url), "utf8");
const result = spawnSync(process.platform === "win32" ? "docker.exe" : "docker", [
  "exec", "-i", "supabase_db_retinacare-beta", "psql", "-X", "-q", "-U", "postgres",
  "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-P", "pager=off",
], { input: sql, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) console.error(`Local retinal QA failed: ${result.error.message}`);
process.exitCode = result.error ? 1 : (result.status ?? 1);
