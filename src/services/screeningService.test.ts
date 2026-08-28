import { describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { ScreeningService } from "./screeningService";

describe("ScreeningService Supabase integration", () => {
  it("registers image metadata through the atomic replacement RPC", async () => {
    vi.stubGlobal("crypto", undefined);
    let rpcArgs: Record<string, unknown> | null = null;
    const row = {
      id: "40000000-0000-4000-8000-000000000099",
      organization_id: organizationId,
      patient_id: patientId,
      screening_id: screeningId,
      laterality: "OD",
      captured_at: "2026-08-28T00:00:00Z",
      uploaded_by: actorUserId,
      original_file_name: "qa.png",
      storage_path: `${organizationId}/${patientId}/${screeningId}/OD/1.png`,
      mime_type: "image/png",
      size_bytes: 3,
      hash_sha256: null,
      status: "ACTIVA",
      replaced_by_image_id: null,
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-08-28T00:00:00Z",
      updated_at: "2026-08-28T00:00:00Z",
    };
    const query = { eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(() => ({ data: null, error: null })), single: vi.fn(() => ({ data: row, error: null })) };
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    const client = {
      storage: { from: () => ({ upload: vi.fn(() => ({ error: null })) }) },
      from(table: string) {
        if (table === "retinal_images") return { select: () => query };
        return { insert: vi.fn(() => ({ error: null })) };
      },
      rpc(name: string, args: Record<string, unknown>) {
        expect(name).toBe("register_retinal_image");
        rpcArgs = args;
        return { data: row.id, error: null };
      },
    } as unknown as TypedSupabaseClient;

    const service = new ScreeningService(client);
    const image = await service.uploadOrReplaceImage(
      { organizationId, actorUserId },
      { patientId, screeningId, laterality: "OD", file: new File([new Uint8Array([1, 2, 3])], "qa.png", { type: "image/png" }) },
    );

    expect(image.id).toBe(row.id);
    expect(rpcArgs).toMatchObject({
      target_organization_id: organizationId,
      target_patient_id: patientId,
      target_screening_id: screeningId,
      target_laterality: "OD",
      target_original_file_name: "qa.png",
    });
    vi.unstubAllGlobals();
  });
});

const organizationId = "10000000-0000-4000-8000-000000000001";
const patientId = "20000000-0000-4000-8000-000000000001";
const screeningId = "30000000-0000-4000-8000-000000000001";
const actorUserId = "90000000-0000-4000-8000-000000000003";
