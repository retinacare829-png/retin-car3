export const clinicThemes = {
  retina: { label: "RetinaCare", primary: "#087a70", dark: "#075e57", soft: "#e8f6f3", sidebar: "#123e3a", accent: "#9ee3d8" },
  ocean: { label: "Océano", primary: "#14679e", dark: "#105479", soft: "#e7f4fb", sidebar: "#143a52", accent: "#8ed8f3" },
  violet: { label: "Violeta", primary: "#684db2", dark: "#543c93", soft: "#f0ebfb", sidebar: "#342853", accent: "#cfb8ff" },
  sunset: { label: "Atardecer", primary: "#a45139", dark: "#873f2c", soft: "#fff1eb", sidebar: "#59362c", accent: "#ffcab2" },
} as const;

export type ClinicTheme = keyof typeof clinicThemes;

export function isClinicTheme(value: string): value is ClinicTheme {
  return Object.hasOwn(clinicThemes, value);
}

export const CLINIC_LOGO_MAX_BYTES = 1024 * 1024;
export const CLINIC_LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateClinicLogo(file: Pick<File, "size" | "type">): string | null {
  if (!CLINIC_LOGO_MIME_TYPES.includes(file.type as (typeof CLINIC_LOGO_MIME_TYPES)[number])) {
    return "El logo debe ser JPG, PNG o WEBP. No se admiten SVG.";
  }
  if (file.size === 0 || file.size > CLINIC_LOGO_MAX_BYTES) {
    return "El logo debe pesar más de 0 y como máximo 1 MB.";
  }
  return null;
}
