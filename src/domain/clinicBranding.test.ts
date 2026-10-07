import { describe, expect, it } from "vitest";
import { isClinicTheme, validateClinicLogo } from "./clinicBranding";

describe("identidad visual por clínica", () => {
  it("solo acepta paletas definidas", () => {
    expect(isClinicTheme("ocean")).toBe(true);
    expect(isClinicTheme("javascript:alert(1)")).toBe(false);
  });

  it("limita el logo a imágenes seguras de 1 MB", () => {
    expect(validateClinicLogo({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateClinicLogo({ type: "image/svg+xml", size: 1024 })).toMatch(/No se admiten SVG/);
    expect(validateClinicLogo({ type: "image/png", size: 1024 * 1024 + 1 })).toMatch(/máximo 1 MB/);
  });
});
