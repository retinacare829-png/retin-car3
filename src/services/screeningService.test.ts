import { describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { screeningFormSchema } from "../domain/screening";
import { ScreeningService } from "./screeningService";

describe("ScreeningService Supabase integration", () => {
  it("crea un screening con el formulario ya normalizado y sin revisor", async () => {
    const form = screeningFormSchema.parse({
      patientId,
      status: "CAPTURA_PENDIENTE",
      generalObservations: "Prueba ficticia",
      assignedReviewerId: "",
    });
    const row = {
      id: screeningId,
      organization_id: organizationId,
      patient_id: patientId,
      medical_record_code: "004",
      status: form.status,
      general_observations: form.generalObservations,
      assigned_reviewer_id: null,
      created_by: actorUserId,
      updated_by: null,
      closed_at: null,
      closed_by: null,
      patient_published_at: null,
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-10-08T00:00:00Z",
      updated_at: "2026-10-08T00:00:00Z",
    };
    const insertScreening = vi.fn(() => ({ select: () => ({ single: () => ({ data: row, error: null }) }) }));
    const insertAudit = vi.fn(() => ({ error: null }));
    const insertTimeline = vi.fn(() => ({ error: null }));
    const client = {
      from(table: string) {
        if (table === "screenings") return { insert: insertScreening };
        if (table === "audit_logs") return { insert: insertAudit };
        if (table === "patient_timeline_events") return { insert: insertTimeline };
        throw new Error(`Tabla inesperada: ${table}`);
      },
    } as unknown as TypedSupabaseClient;

    const created = await new ScreeningService(client).createScreening({ organizationId, actorUserId }, form);

    expect(created.recordCode).toBe("004");
    expect(insertScreening).toHaveBeenCalledWith(expect.objectContaining({
      patient_id: patientId,
      assigned_reviewer_id: null,
      general_observations: "Prueba ficticia",
    }));
    expect(insertAudit).toHaveBeenCalledOnce();
    expect(insertTimeline).toHaveBeenCalledOnce();
  });

  it("rechaza un archivo demasiado grande sin contactar Storage", async () => {
    const upload = vi.fn();
    const storageFrom = vi.fn(() => ({ upload }));
    const client = { storage: { from: storageFrom } } as unknown as TypedSupabaseClient;
    const service = new ScreeningService(client);

    await expect(service.uploadOrReplaceImage(
      { organizationId, actorUserId },
      { patientId, screeningId, laterality: "OD", file: new File([new Uint8Array(15 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }) },
    )).rejects.toThrow("15 MB");
    expect(storageFrom).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

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
