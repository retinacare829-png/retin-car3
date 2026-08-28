import type { RetinalImageLaterality } from "./screening";

export const RETINAL_IMAGE_BUCKET = "retinal-images-private";
export const SIGNED_IMAGE_URL_TTL_SECONDS = 300;
export const RETINAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

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
