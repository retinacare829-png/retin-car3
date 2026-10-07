import { describe, expect, it } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { ReportService } from "./reportService";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  patientId: "20000000-0000-4000-8000-000000000001",
  screeningId: "30000000-0000-4000-8000-000000000001",
  actorUserId: "40000000-0000-4000-8000-000000000001",
  actorRole: "authorized_professional" as const,
};

describe("ReportService", () => {
  it("blocks report generation for technical staff before persistence reads", async () => {
    await expect(new ReportService({} as TypedSupabaseClient).generate({ ...context, actorRole: "technical_staff" })).rejects.toThrow(/Solo un administrador/);
  });

  it("applies organization and optional filters when listing candidates", async () => {
    const calls: Array<[string, unknown]> = [];
    const client = createClient({ screenings: {
      data: [{
        id: context.screeningId, organization_id: context.organizationId, patient_id: context.patientId,
        status: "REVISADO", created_at: "2026-10-06T10:00:00.000Z", closed_at: null,
      }], error: null,
    }, patients: {
      data: [{ id: context.patientId, organization_id: context.organizationId, internal_identifier: "P-1", first_names: "Paciente", last_names: "Demo" }], error: null,
    } }, calls);

    const candidates = await new ReportService(client).listCandidates({
      organizationId: context.organizationId, patientId: context.patientId, createdFrom: "2026-10-01", createdTo: "2026-10-06",
    }, context.actorRole);

    expect(candidates[0]).toMatchObject({ organizationId: context.organizationId, screeningId: context.screeningId, patientName: "Paciente Demo" });
    expect(calls).toContainEqual(["organization_id", context.organizationId]);
    expect(calls).toContainEqual(["patient_id", context.patientId]);
  });

  it("builds a non-diagnostic report from current source rows and never exposes storage paths", async () => {
    const client = createClient({
      patients: { data: patientRow, error: null },
      screenings: { data: screeningRow, error: null },
      retinal_images: { data: [imageRow], error: null },
      image_quality_reviews: { data: [qualityRow], error: null },
      professional_reviews: { data: reviewRow, error: null },
      follow_ups: { data: [followUpRow], error: null },
      referrals: { data: [referralRow], error: null },
    });

    const report = await new ReportService(client).generate(context);
    expect(report.scope).toBe("NON_DIAGNOSTIC");
    expect(report.patient.fullName).toBe("Paciente Demo");
    expect(report.screening.status).toBe("REVISADO");
    expect(report.images[0]).toMatchObject({ laterality: "OD", qualityStatus: "ADECUADA" });
    expect(report.professionalReview?.structuredObservations.followUpRecommended).toBe(true);
    expect(report).not.toHaveProperty("diagnosis");
    expect(report.images[0]).not.toHaveProperty("storagePath");
  });

  it("builds a patient report with screening history and operational counts", async () => {
    const client = createClient({
      patients: { data: patientRow, error: null },
      screenings: { data: [screeningRow], error: null },
      retinal_images: { data: [imageRow], error: null },
      professional_reviews: { data: [reviewRow], error: null },
      follow_ups: { data: [followUpRow], error: null },
      referrals: { data: [referralRow], error: null },
    });

    const report = await new ReportService(client).getPatientReport({
      organizationId: context.organizationId, patientId: context.patientId, actorUserId: context.actorUserId, actorRole: context.actorRole,
    });
    expect(report.reportType).toBe("PATIENT_SUMMARY");
    expect(report.screenings[0]).toMatchObject({ id: context.screeningId, followUps: 1, referrals: 1, activeImages: { OD: 1, OI: 0 } });
  });

  it("builds an operational summary only from rows in the requested organization and range", async () => {
    const client = createClient({
      patients: { data: [patientRow], error: null },
      screenings: { data: [screeningRow], error: null },
      professional_reviews: { data: [reviewRow], error: null },
      follow_ups: { data: [followUpRow], error: null },
      referrals: { data: [referralRow], error: null },
    });

    const report = await new ReportService(client).getOperationalSummary({
      organizationId: context.organizationId, from: "2026-10-01", to: "2026-10-31",
    }, context.actorRole, context.actorUserId);
    expect(report).toMatchObject({ reportType: "OPERATIONAL_SUMMARY", organizationId: context.organizationId, totals: { newPatients: 1, screenings: 1, completedScreenings: 1 } });
    expect(report.screeningsByStatus).toEqual([{ status: "REVISADO", total: 1 }]);
  });
});

const patientRow = {
  id: context.patientId, organization_id: context.organizationId, internal_identifier: "P-1", medical_record_code: "E-1",
  first_names: "Paciente", last_names: "Demo", date_of_birth: "1970-01-01", sex: "unknown", diabetes_type: "type_2",
  phone: null, diabetes_diagnosis_date: null, notes: null, created_by: context.actorUserId, updated_by: null,
  deleted_at: null, deleted_by: null, created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-06T10:00:00.000Z",
};
const screeningRow = {
  id: context.screeningId, organization_id: context.organizationId, patient_id: context.patientId, status: "REVISADO",
  general_observations: "Observacion manual", assigned_reviewer_id: context.actorUserId, created_by: context.actorUserId,
  updated_by: context.actorUserId, closed_at: null, closed_by: null, deleted_at: null, deleted_by: null,
  created_at: "2026-10-06T10:00:00.000Z", updated_at: "2026-10-06T11:00:00.000Z",
};
const imageRow = {
  id: "50000000-0000-4000-8000-000000000001", organization_id: context.organizationId, patient_id: context.patientId,
  screening_id: context.screeningId, laterality: "OD", captured_at: "2026-10-06T10:30:00.000Z", uploaded_by: context.actorUserId,
  original_file_name: "od.jpg", storage_path: `${context.organizationId}/${context.patientId}/${context.screeningId}/OD/od.jpg`,
  mime_type: "image/jpeg", size_bytes: 1200, hash_sha256: null, status: "ACTIVA", replaced_by_image_id: null,
  deleted_at: null, deleted_by: null, created_at: "2026-10-06T10:31:00.000Z", updated_at: "2026-10-06T10:31:00.000Z",
};
const qualityRow = {
  id: "60000000-0000-4000-8000-000000000001", organization_id: context.organizationId, patient_id: context.patientId,
  screening_id: context.screeningId, retinal_image_id: imageRow.id, reviewer_user_id: context.actorUserId,
  quality_status: "ADECUADA", reasons: [], other_reason: null, suggestion: null,
  created_at: "2026-10-06T10:32:00.000Z", updated_at: "2026-10-06T10:32:00.000Z",
};
const reviewRow = {
  id: "70000000-0000-4000-8000-000000000001", organization_id: context.organizationId, patient_id: context.patientId,
  screening_id: context.screeningId, reviewer_user_id: context.actorUserId, review_status: "REVISION_COMPLETADA",
  reviewed_at: "2026-10-06T11:00:00.000Z", structured_observations: {
    insufficientQuality: false, repeatedImageRecommended: false, newCaptureRequired: false,
    reviewCompleted: true, followUpRecommended: true, referralRecommended: false,
  }, notes: "Revision manual", created_at: "2026-10-06T10:45:00.000Z", updated_at: "2026-10-06T11:00:00.000Z", deleted_at: null, deleted_by: null,
};
const followUpRow = {
  id: "80000000-0000-4000-8000-000000000001", organization_id: context.organizationId, patient_id: context.patientId,
  screening_id: context.screeningId, created_by: context.actorUserId, assigned_to: null, follow_up_type: "CONTROL_PROGRAMADO",
  follow_up_status: "CONTROL_PROGRAMADO", due_date: "2026-11-06", completed_at: null, notes: "Control manual",
  created_at: "2026-10-06T11:05:00.000Z", updated_at: "2026-10-06T11:05:00.000Z", deleted_at: null, deleted_by: null,
};
const referralRow = {
  id: "90000000-0000-4000-8000-000000000001", organization_id: context.organizationId, patient_id: context.patientId,
  screening_id: context.screeningId, created_by: context.actorUserId, referral_reason: "Revision profesional",
  referral_destination: "Centro demo", referral_status: "BORRADOR", requested_date: "2026-10-06", completed_date: null,
  notes: null, created_at: "2026-10-06T11:06:00.000Z", updated_at: "2026-10-06T11:06:00.000Z", deleted_at: null, deleted_by: null,
};

function createClient(results: Record<string, { data: unknown; error: null }>, calls: Array<[string, unknown]> = []): TypedSupabaseClient {
  return {
    rpc: () => Promise.resolve({ data: true, error: null }),
    from(table: string) {
      const result = results[table] ?? { data: [], error: null };
      const resultData = result.data;
      const singleData = Array.isArray(resultData) ? (resultData as unknown[])[0] ?? null : resultData;
      const query: Record<string, unknown> = {
        select: () => query,
        eq: (field: string, value: unknown) => { calls.push([field, value]); return query; },
        is: () => query,
        in: () => query,
        order: () => query,
        gte: () => query,
        lt: () => query,
        lte: () => query,
        neq: () => query,
        maybeSingle: () => Promise.resolve({ data: singleData, error: result.error }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  } as unknown as TypedSupabaseClient;
}
