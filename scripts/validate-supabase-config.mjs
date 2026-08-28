import { readFileSync } from "node:fs";

const files = {
  env: ".env.example",
  config: "supabase/config.toml",
  migration: "supabase/migrations/202608280002_phase_4_6_supabase_validation.sql",
  storageMigration: "supabase/migrations/202608270001_phase_3_screenings_images.sql",
  seed: "supabase/seed.sql",
  sqlQa: "supabase/tests/phase_4_6_rls_validation.sql",
  service: "src/services/clinicalWorkflowService.ts",
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]),
);

const checks = [
  ["variables publicas documentadas", content.env.includes("VITE_SUPABASE_URL=") && content.env.includes("VITE_SUPABASE_ANON_KEY=")],
  ["seed local habilitado", content.config.includes("[db.seed]") && content.config.includes("./seed.sql")],
  ["Storage local habilitado", content.config.includes("[storage]") && content.config.includes('file_size_limit = "15MiB"')],
  ["bucket privado", content.storageMigration.includes("'retinal-images-private'") && /'retinal-images-private',[\s\S]*?false,/.test(content.storageMigration)],
  ["claves multi-tenant compuestas", content.migration.includes("retinal_images_screening_tenant_fk") && content.migration.includes("image_quality_reviews_image_tenant_fk")],
  ["cierre atomico", content.migration.includes("close_screening_workflow") && content.service.includes('.rpc("close_screening_workflow"')],
  ["reemplazo de imagen atomico", content.migration.includes("register_retinal_image")],
  ["pruebas RLS ejecutables", content.sqlQa.includes("QA Supabase Fase 4.6: OK") && content.sqlQa.includes("rollback;")],
  ["roles demo", ["clinic_admin", "technical_staff", "authorized_professional", "suspended"].every((role) => content.seed.includes(role))],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) {
  console.log(`${passed ? "OK" : "ERROR"} ${label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Configuracion Supabase Fase 4.6 validada estaticamente.");
}
