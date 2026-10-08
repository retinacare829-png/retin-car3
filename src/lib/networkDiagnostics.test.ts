import { describe, expect, it } from "vitest";
import { sharedDemoUsesLocalSupabase } from "./networkDiagnostics";

describe("diagnóstico de acceso desde otros equipos", () => {
  it("detecta un backend local desde un navegador en la red", () => {
    expect(sharedDemoUsesLocalSupabase("192.168.0.42", "http://127.0.0.1:54321", "local")).toBe(true);
    expect(sharedDemoUsesLocalSupabase("clinica.example", "http://localhost:54321", "local")).toBe(true);
    expect(sharedDemoUsesLocalSupabase("192.168.0.30", "http://192.168.0.30:54321", "local")).toBe(true);
  });

  it("permite el desarrollo local y el backend hospedado", () => {
    expect(sharedDemoUsesLocalSupabase("localhost", "http://127.0.0.1:54321", "local")).toBe(false);
    expect(sharedDemoUsesLocalSupabase("192.168.0.42", "https://demo.supabase.co", "staging")).toBe(false);
    expect(sharedDemoUsesLocalSupabase("192.168.0.42", null, "local")).toBe(false);
  });
});
