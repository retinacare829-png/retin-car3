import { describe, expect, it } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { ClinicalWorkflowService } from "./clinicalWorkflowService";

describe("ClinicalWorkflowService", () => {
  it("validates a professional review before touching persistence", async () => {
    const service = new ClinicalWorkflowService({} as TypedSupabaseClient);
    await expect(service.saveProfessionalReview({
      organizationId: "10000000-0000-4000-8000-000000000001",
      patientId: "20000000-0000-4000-8000-000000000001",
      screeningId: "30000000-0000-4000-8000-000000000001",
      actorUserId: "40000000-0000-4000-8000-000000000001",
    }, {
      reviewStatus: "EN_REVISION",
      structuredObservations: {
        insufficientQuality: false, repeatedImageRecommended: false, newCaptureRequired: false,
        reviewCompleted: false, followUpRecommended: false, referralRecommended: false,
      },
      notes: "x".repeat(1601),
    })).rejects.toThrow();
  });

  it("creates a follow up and records audit and timeline without free text metadata", async () => {
    const inserted: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const client = createMutationClient(inserted, {
      id: "70000000-0000-4000-8000-000000000001", organization_id: "10000000-0000-4000-8000-000000000001",
      patient_id: "20000000-0000-4000-8000-000000000001", screening_id: "30000000-0000-4000-8000-000000000001",
      created_by: "40000000-0000-4000-8000-000000000001", assigned_to: null, follow_up_type: "CONTROL_PROGRAMADO",
      follow_up_status: "CONTROL_PROGRAMADO", urgency: "urgent", due_date: "2026-09-10", completed_at: null, notes: "Nota privada",
      created_at: "2026-08-28T00:00:00Z", updated_at: "2026-08-28T00:00:00Z", deleted_at: null, deleted_by: null,
    });
    const service = new ClinicalWorkflowService(client);
    await service.createFollowUp(context, { assignedTo: null, followUpType: "CONTROL_PROGRAMADO", followUpStatus: "CONTROL_PROGRAMADO", urgency: "urgent", dueDate: "2026-09-10", completedAt: null, notes: null });
    expect(inserted.map((entry) => entry.table)).toEqual(["follow_ups", "audit_logs", "patient_timeline_events"]);
    expect(inserted[0]?.payload.urgency).toBe("urgent");
    expect(inserted.find((entry) => entry.table === "audit_logs")?.payload.metadata).not.toHaveProperty("notes");
  });

  it("creates a referral with its requested date", async () => {
    const inserted: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const client = createMutationClient(inserted, {
      id: "80000000-0000-4000-8000-000000000001", organization_id: context.organizationId,
      patient_id: context.patientId, screening_id: context.screeningId, created_by: context.actorUserId,
      referral_reason: "Evaluacion manual", referral_destination: "Centro demo", referral_status: "SOLICITADA",
      requested_date: "2026-08-28", completed_date: null, notes: null, created_at: "2026-08-28T00:00:00Z",
      updated_at: "2026-08-28T00:00:00Z", deleted_at: null, deleted_by: null,
    });
    const service = new ClinicalWorkflowService(client);
    const referral = await service.createReferral(context, { referralReason: "Evaluacion manual", referralDestination: "Centro demo", referralStatus: "SOLICITADA", requestedDate: "2026-08-28", completedDate: "", notes: "" });
    expect(referral.requestedDate).toBe("2026-08-28");
    expect(inserted.map((entry) => entry.table)).toEqual(["referrals", "audit_logs", "patient_timeline_events"]);
  });

  it("closes the workflow through the atomic Supabase RPC", async () => {
    let calledWith: Record<string, string> | null = null;
    const client = {
      rpc(name: string, args: Record<string, string>) {
        expect(name).toBe("close_screening_workflow");
        calledWith = args;
        return { error: null };
      },
    } as unknown as TypedSupabaseClient;
    await new ClinicalWorkflowService(client).closeScreening(context);
    expect(calledWith).toEqual({
      target_organization_id: context.organizationId,
      target_patient_id: context.patientId,
      target_screening_id: context.screeningId,
    });
  });
});

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001", patientId: "20000000-0000-4000-8000-000000000001",
  screeningId: "30000000-0000-4000-8000-000000000001", actorUserId: "40000000-0000-4000-8000-000000000001",
};

function createMutationClient(inserted: Array<{ table: string; payload: Record<string, unknown> }>, row: Record<string, unknown>): TypedSupabaseClient {
  return {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          inserted.push({ table, payload });
          if (table === "audit_logs" || table === "patient_timeline_events") return { error: null };
          return { select: () => ({ single: () => ({ data: row, error: null }) }) };
        },
      };
    },
  } as unknown as TypedSupabaseClient;
}
