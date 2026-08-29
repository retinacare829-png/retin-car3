import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const password = process.env.SUPABASE_QA_PASSWORD || "RetinaCare-Demo-2026!";
const email = process.env.SUPABASE_QA_ADMIN_EMAIL || "admin.demo@example.test";

if (!url || !anonKey) throw new Error("Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.");
const host = new URL(url).hostname;
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
  throw new Error("La carga de imágenes demo solo está permitida contra Supabase local.");
}

const organizationId = "10000000-0000-4000-8000-000000000001";
const patientId = "20000000-0000-4000-8000-000000000001";
const screeningId = "30000000-0000-4000-8000-000000000001";
const bucket = "retinal-images-private";
const assets = [
  { laterality: "OD", file: "assets/demo/demo-od-synthetic.jpg", name: "demo-od-placeholder.jpg" },
  { laterality: "OI", file: "assets/demo/demo-oi-synthetic.jpg", name: "demo-oi-placeholder.jpg" },
];

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await client.auth.signInWithPassword({ email, password });
if (authError) throw new Error(`No fue posible iniciar la sesión demo: ${authError.message}`);

try {
  for (const asset of assets) {
    const path = `${organizationId}/${patientId}/${screeningId}/${asset.laterality}/${asset.name}`;
    let { data: signed, error: signedError } = await client.storage.from(bucket).createSignedUrl(path, 60);
    if (signedError) {
      const bytes = await readFile(resolve(asset.file));
      const { error: uploadError } = await client.storage.from(bucket).upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw new Error(`Carga ${asset.laterality}: ${uploadError.message}`);
      ({ data: signed, error: signedError } = await client.storage.from(bucket).createSignedUrl(path, 60));
    }
    if (signedError) throw new Error(`URL firmada ${asset.laterality}: ${signedError.message}`);
    const response = await fetch(signed.signedUrl);
    if (!response.ok || response.headers.get("content-type")?.startsWith("image/jpeg") === false) {
      throw new Error(`La verificación privada de ${asset.laterality} falló (${response.status}).`);
    }
    console.log(`OK ${asset.laterality}: archivo sintético privado y URL firmada válida.`);
  }
} finally {
  await client.auth.signOut();
}

console.log("Storage demo local preparado de forma idempotente.");
