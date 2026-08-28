import { createClient } from "@supabase/supabase-js";

function fail(error) {
  console.error(`QA Supabase no completada: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.");
}

const local = ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
const password = process.env.SUPABASE_QA_PASSWORD || (local ? "RetinaCare-Demo-2026!" : "");
if (!password) {
  throw new Error("SUPABASE_QA_PASSWORD es obligatorio para validar un entorno hospedado.");
}

const accounts = {
  adminA: process.env.SUPABASE_QA_ADMIN_EMAIL || "admin.demo@example.test",
  techA: process.env.SUPABASE_QA_TECH_EMAIL || "tecnico.demo@example.test",
  professionalA: process.env.SUPABASE_QA_PROFESSIONAL_EMAIL || "profesional.demo@example.test",
  adminB: process.env.SUPABASE_QA_OTHER_TENANT_EMAIL || "admin.clinica-b@example.test",
  suspended: process.env.SUPABASE_QA_SUSPENDED_EMAIL || "suspendido.demo@example.test",
  noOrganization: process.env.SUPABASE_QA_NO_ORG_EMAIL || "sin.clinica.demo@example.test",
};

const organizationA = "10000000-0000-4000-8000-000000000001";
const organizationB = "10000000-0000-4000-8000-000000000002";
const bucket = "retinal-images-private";
const results = [];

function client() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function ok(label, detail = "") {
  results.push({ label, passed: true, detail });
  console.log(`OK ${label}${detail ? `: ${detail}` : ""}`);
}

function assert(condition, label, detail = "") {
  if (!condition) throw new Error(`QA_FAILED ${label}${detail ? `: ${detail}` : ""}`);
  ok(label, detail);
}

async function login(email) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email}: ${error.message}`);
  assert(Boolean(data.session && data.user), `login ${email}`);
  return supabase;
}

async function membershipsFor(supabase) {
  const { data, error } = await supabase.from("organization_members").select("organization_id, role, status");
  if (error) throw error;
  return data ?? [];
}

const adminA = await login(accounts.adminA);
const adminAMemberships = await membershipsFor(adminA);
assert(adminAMemberships.some((item) => item.organization_id === organizationA && item.role === "clinic_admin"), "rol clinic_admin en Clinica A");

const { data: patientsA, error: patientsAError } = await adminA.from("patients").select("id, organization_id").eq("organization_id", organizationA);
if (patientsAError) throw patientsAError;
assert((patientsA ?? []).length >= 2, "lectura de pacientes del tenant activo");
const { data: patientsBFromA, error: patientsBError } = await adminA.from("patients").select("id").eq("organization_id", organizationB);
if (patientsBError) throw patientsBError;
assert((patientsBFromA ?? []).length === 0, "aislamiento de pacientes entre tenants");

const techA = await login(accounts.techA);
assert((await membershipsFor(techA)).some((item) => item.role === "technical_staff"), "rol technical_staff");
const professionalA = await login(accounts.professionalA);
assert((await membershipsFor(professionalA)).some((item) => item.role === "authorized_professional"), "rol authorized_professional");
const adminB = await login(accounts.adminB);
assert((await membershipsFor(adminB)).every((item) => item.organization_id === organizationB), "admin Clinica B aislado de Clinica A");
const suspended = await login(accounts.suspended);
assert((await membershipsFor(suspended)).length === 0, "membresia suspendida sin acceso");
const noOrganization = await login(accounts.noOrganization);
assert((await membershipsFor(noOrganization)).length === 0, "usuario sin organizacion");

const { error: resetError } = await noOrganization.auth.resetPasswordForEmail(accounts.noOrganization, { redirectTo: "http://127.0.0.1:5173" });
if (resetError) throw resetError;
ok("solicitud de recuperacion de contraseña");

if (process.env.SUPABASE_QA_ALLOW_STORAGE_MUTATIONS === "true") {
  const suffix = Date.now();
  const path = `${organizationA}/20000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000003/OD/qa-${suffix}.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const { error: uploadError } = await techA.storage.from(bucket).upload(path, png, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  ok("subida a Storage privado", path);

  const { data: signed, error: signedError } = await professionalA.storage.from(bucket).createSignedUrl(path, 300);
  if (signedError) throw signedError;
  const signedResponse = await fetch(signed.signedUrl);
  assert(signedResponse.ok, "URL firmada accesible por miembro autorizado");

  const publicResponse = await fetch(`${url}/storage/v1/object/public/${bucket}/${path}`);
  assert(!publicResponse.ok, "acceso publico directo bloqueado");
  const { error: otherTenantSignedError } = await adminB.storage.from(bucket).createSignedUrl(path, 60);
  assert(Boolean(otherTenantSignedError), "URL firmada bloqueada para otro tenant");
} else {
  console.log("SKIP Storage HTTP: establezca SUPABASE_QA_ALLOW_STORAGE_MUTATIONS=true en un entorno desechable.");
}

await Promise.all([adminA.auth.signOut(), techA.auth.signOut(), professionalA.auth.signOut(), adminB.auth.signOut(), suspended.auth.signOut(), noOrganization.auth.signOut()]);
const { data: finalSession } = await adminA.auth.getSession();
assert(finalSession.session === null, "logout y limpieza de sesion");

console.log(`QA Supabase HTTP completada: ${results.length} verificaciones.`);
