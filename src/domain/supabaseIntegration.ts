import type { RetinalImageLaterality } from "./screening";

export const RETINAL_IMAGE_BUCKET = "retinal-images-private";
export const SIGNED_IMAGE_URL_TTL_SECONDS = 300;
export const RETINAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const RETINAL_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateRetinalImageFile(file: File): string | null {
  if (!RETINAL_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as (typeof RETINAL_IMAGE_ALLOWED_MIME_TYPES)[number])) {
    return "Seleccione una imagen JPG, PNG o WEBP.";
  }

  if (file.size <= 0) {
    return "El archivo seleccionado está vacío.";
  }

  if (file.size > RETINAL_IMAGE_MAX_BYTES) {
    return "La imagen supera el límite de 15 MB.";
  }

  return null;
}

export interface RetinalStoragePathInput {
  organizationId: string;
  patientId: string;
  screeningId: string;
  laterality: RetinalImageLaterality;
  originalFileName: string;
  timestamp?: number;
}

export function buildRetinalStoragePath(input: RetinalStoragePathInput): string {
  const extension = input.originalFileName.split(".").pop()?.toLocaleLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${input.organizationId}/${input.patientId}/${input.screeningId}/${input.laterality}/${input.timestamp ?? Date.now()}.${extension}`;
}

export function isRetinalStoragePathScoped(
  storagePath: string,
  context: Pick<RetinalStoragePathInput, "organizationId" | "patientId" | "screeningId" | "laterality">,
): boolean {
  const prefix = `${context.organizationId}/${context.patientId}/${context.screeningId}/${context.laterality}/`;
  return storagePath.startsWith(prefix) && storagePath.length > prefix.length;
}
