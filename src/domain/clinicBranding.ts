export const clinicThemes = {
  retina: { label: "RetinaCare", primary: "#456e68", dark: "#2b4741", soft: "#edf1f0", sidebar: "#2b4741", accent: "#eda69d" },
  ocean: { label: "Océano", primary: "#14679e", dark: "#105479", soft: "#e7f4fb", sidebar: "#143a52", accent: "#8ed8f3" },
  violet: { label: "Violeta", primary: "#684db2", dark: "#543c93", soft: "#f0ebfb", sidebar: "#342853", accent: "#cfb8ff" },
  sunset: { label: "Atardecer", primary: "#a45139", dark: "#873f2c", soft: "#fff1eb", sidebar: "#59362c", accent: "#ffcab2" },
} as const;

export type ClinicTheme = keyof typeof clinicThemes | "logo";

export interface ClinicPalette { primary: string; dark: string; soft: string; sidebar: string; accent: string; }

export function isClinicTheme(value: string): value is ClinicTheme {
  return value === "logo" || Object.hasOwn(clinicThemes, value);
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

export function validateLogoDimensions(width: number, height: number): string | null {
  if (Math.min(width, height) < 96 || Math.max(width, height) > 4096) {
    return "El logo debe medir entre 96 y 4096 píxeles por lado.";
  }
  if (Math.max(width, height) / Math.min(width, height) > 5) {
    return "El logo debe tener una proporción máxima de 5:1 para verse bien en el panel.";
  }
  return null;
}

function whiteContrastForHsl(hue: number, saturation: number, lightness: number): number {
  const normalizedLightness = lightness / 100;
  const chroma = saturation / 100 * Math.min(normalizedLightness, 1 - normalizedLightness);
  const channel = (position: number) => {
    const sector = (position + hue / 30) % 12;
    const value = normalizedLightness - chroma * Math.max(-1, Math.min(sector - 3, 9 - sector, 1));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
  return 1.05 / (luminance + 0.05);
}

/** Escoge el color cromático dominante; los píxeles blancos o transparentes no cuentan. */
export function paletteFromPixels(pixels: Uint8ClampedArray): ClinicPalette {
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, hue: 0, saturation: 0 }));
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = (pixels[index + 3] ?? 0) / 255;
    if (alpha < 0.5) continue;
    const red = (pixels[index] ?? 0) / 255;
    const green = (pixels[index + 1] ?? 0) / 255;
    const blue = (pixels[index + 2] ?? 0) / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const difference = maximum - minimum;
    const lightness = (maximum + minimum) / 2;
    const saturation = difference === 0 ? 0 : difference / (1 - Math.abs(2 * lightness - 1));
    if (saturation < 0.18 || lightness < 0.045 || lightness > 0.94) continue;
    let hue = maximum === red ? ((green - blue) / difference) % 6 : maximum === green ? (blue - red) / difference + 2 : (red - green) / difference + 4;
    hue = (hue * 60 + 360) % 360;
    const bucket = buckets[Math.floor(hue / 15)];
    if (!bucket) continue;
    const weight = alpha * (0.4 + saturation * saturation);
    bucket.weight += weight;
    bucket.hue += hue * weight;
    bucket.saturation += saturation * weight;
  }
  const dominant = buckets.reduce((best, current) => current.weight > best.weight ? current : best);
  if (dominant.weight < 1) return clinicThemes.retina;
  const hue = Math.round(dominant.hue / dominant.weight);
  const saturation = Math.round(Math.min(78, Math.max(48, dominant.saturation / dominant.weight * 100)));
  let primaryLightness = 34;
  while (primaryLightness > 20 && whiteContrastForHsl(hue, saturation, primaryLightness) < 4.5) primaryLightness--;
  return {
    primary: `hsl(${hue} ${saturation}% ${primaryLightness}%)`,
    dark: `hsl(${hue} ${saturation}% ${Math.max(16, primaryLightness - 8)}%)`,
    soft: `hsl(${hue} ${Math.min(saturation, 65)}% 94%)`,
    sidebar: `hsl(${hue} ${Math.min(saturation, 58)}% 17%)`,
    accent: `hsl(${hue} ${Math.min(saturation, 72)}% 76%)`,
  };
}

export async function paletteFromLogo(blob: Blob): Promise<ClinicPalette> {
  const bitmap = await createImageBitmap(blob);
  try {
    const dimensionError = validateLogoDimensions(bitmap.width, bitmap.height);
    if (dimensionError) throw new Error(dimensionError);
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No se pudo leer el color del logo.");
    context.drawImage(bitmap, 0, 0, 48, 48);
    return paletteFromPixels(context.getImageData(0, 0, 48, 48).data);
  } finally {
    bitmap.close();
  }
}
