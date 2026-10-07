import { describe, expect, it } from "vitest";
import { isClinicTheme, paletteFromPixels, validateClinicLogo, validateLogoDimensions } from "./clinicBranding";

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

  it("rechaza logos demasiado pequeños o desproporcionados", () => {
    expect(validateLogoDimensions(80, 80)).toMatch(/96/);
    expect(validateLogoDimensions(1200, 100)).toMatch(/5:1/);
    expect(validateLogoDimensions(500, 250)).toBeNull();
  });

  it("deriva una identidad distinta para logos rojos y azules", () => {
    const pixels = (red: number, green: number, blue: number) => new Uint8ClampedArray(Array.from({ length: 100 }, () => [red, green, blue, 255]).flat());
    const red = paletteFromPixels(pixels(210, 30, 40));
    const blue = paletteFromPixels(pixels(20, 60, 185));
    expect(red.primary).not.toBe(blue.primary);
    expect(red.sidebar).not.toBe(blue.sidebar);
    const yellow = paletteFromPixels(pixels(235, 210, 20));
    expect(yellow.primary).toMatch(/hsl\(.*% (2[0-9]|3[0-3])%\)/);
  });

  it("vuelve al tema RetinaCare si el logo no contiene colores utilizables", () => {
    expect(paletteFromPixels(new Uint8ClampedArray(400).fill(255)).primary).toBe("#087a70");
  });
});
