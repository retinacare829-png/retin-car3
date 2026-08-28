import { describe, expect, it } from "vitest";
import {
  buildRetinalStoragePath,
  isRetinalStoragePathScoped,
  RETINAL_IMAGE_BUCKET,
  RETINAL_IMAGE_MAX_BYTES,
  SIGNED_IMAGE_URL_TTL_SECONDS,
} from "./supabaseIntegration";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  patientId: "20000000-0000-4000-8000-000000000001",
  screeningId: "30000000-0000-4000-8000-000000000001",
  laterality: "OD" as const,
};

describe("Supabase private retinal storage configuration", () => {
  it("uses the private bucket and a five-minute signed URL", () => {
    expect(RETINAL_IMAGE_BUCKET).toBe("retinal-images-private");
    expect(SIGNED_IMAGE_URL_TTL_SECONDS).toBe(300);
    expect(RETINAL_IMAGE_MAX_BYTES).toBe(15_728_640);
  });

  it("builds tenant-scoped paths with a sanitized extension", () => {
    const path = buildRetinalStoragePath({ ...context, originalFileName: "captura.FiNaL.JpG!", timestamp: 1234 });
    expect(path).toBe(`${context.organizationId}/${context.patientId}/${context.screeningId}/OD/1234.jpg`);
    expect(isRetinalStoragePathScoped(path, context)).toBe(true);
  });

  it("rejects a path from another organization", () => {
    const path = buildRetinalStoragePath({ ...context, organizationId: "10000000-0000-4000-8000-000000000002", originalFileName: "qa.png", timestamp: 1 });
    expect(isRetinalStoragePathScoped(path, context)).toBe(false);
  });
});
