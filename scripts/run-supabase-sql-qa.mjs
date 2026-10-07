import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const container = process.env.SUPABASE_DB_CONTAINER || "supabase_db_retinacare-beta";
const sql = readFileSync("supabase/tests/phase_6_security_qa.sql", "utf8");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

const child = spawn(
  dockerCommand,
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { stdio: ["pipe", "inherit", "inherit"] },
);

child.on("error", (error) => {
  console.error(`No se pudo ejecutar Docker/psql: ${error.message}`);
  console.error("Levante Supabase local con `npx supabase start` antes de ejecutar este script.");
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

child.stdin.end(sql);
