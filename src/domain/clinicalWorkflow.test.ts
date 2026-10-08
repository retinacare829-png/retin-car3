import { describe, expect, it } from "vitest";
import { buildClosureChecklist, followUpSchema, professionalReviewSchema, referralSchema, type ClinicalWorkflowDetail } from "./clinicalWorkflow";
import type { ScreeningDetail } from "./screening";

const screening: ScreeningDetail = {
  id: "30000000-0000-4000-8000-000000000001", organizationId: "10000000-0000-4000-8000-000000000001",
  patientId: "20000000-0000-4000-8000-000000000001", recordCode: "EXP-01000000", status: "PENDIENTE_REVISION", generalObservations: null,
  assignedReviewerId: null, createdBy: "user", updatedBy: null, closedAt: null, closedBy: null, patientPublishedAt: null, deletedAt: null,
  deletedBy: null, createdAt: "2026-08-28T00:00:00Z", updatedAt: "2026-08-28T00:00:00Z",
  images: (["OD", "OI"] as const).map((laterality, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`, organizationId: "10000000-0000-4000-8000-000000000001",
    patientId: "20000000-0000-4000-8000-000000000001", screeningId: "30000000-0000-4000-8000-000000000001",
    laterality, capturedAt: "2026-08-28T00:00:00Z", uploadedBy: "user", originalFileName: `${laterality}.jpg`,
    storagePath: `org/patient/screening/${laterality}.jpg`, mimeType: "image/jpeg", sizeBytes: 10, hashSha256: null,
    status: "ACTIVA", replacedByImageId: null, deletedAt: null, deletedBy: null, createdAt: "2026-08-28T00:00:00Z", updatedAt: "2026-08-28T00:00:00Z",
  })),
  qualityReviews: [],
};

const workflow: ClinicalWorkflowDetail = { professionalReview: null, followUps: [], referrals: [] };

describe("professional workflow validation", () => {
  it("accepts structured manual observations without interpreting them", () => {
    expect(professionalReviewSchema.safeParse({ reviewStatus: "EN_REVISION", structuredObservations: { insufficientQuality: true }, notes: "" }).success).toBe(true);
  });

  it("validates follow ups and referrals", () => {
    expect(followUpSchema.safeParse({ assignedTo: "", followUpType: "REPETIR_ESTUDIO", followUpStatus: "REPETIR_ESTUDIO", dueDate: "2026-09-10", notes: "" }).success).toBe(true);
    expect(referralSchema.safeParse({ referralReason: "Evaluacion manual", referralDestination: "Clinica demo", referralStatus: "SOLICITADA", requestedDate: "2026-08-28", notes: "" }).success).toBe(true);
  });
});

describe("screening closure checklist", () => {
  it("reports every missing operational requirement", () => {
    const result = buildClosureChecklist(screening, workflow);
    expect(result.canClose).toBe(false);
    expect(result.missing).toContain("Calidad OD registrada");
    expect(result.missing).toContain("Revision profesional completada");
    expect(result.missing).toContain("Seguimiento o decision registrada");
  });

  it("allows closure only after bilateral quality, completed review and explicit decision", () => {
    const qualityReviews = screening.images.map((image, index) => ({
      id: `50000000-0000-4000-8000-00000000000${index + 1}`, organizationId: screening.organizationId,
      patientId: screening.patientId, screeningId: screening.id, retinalImageId: image.id, reviewerUserId: "user",
      qualityStatus: "ADECUADA" as const, reasons: [], otherReason: null, suggestion: null,
      createdAt: screening.createdAt, updatedAt: screening.updatedAt,
    }));
    const completeWorkflow: ClinicalWorkflowDetail = {
      professionalReview: {
        id: "60000000-0000-4000-8000-000000000001", organizationId: screening.organizationId, patientId: screening.patientId,
        screeningId: screening.id, reviewerUserId: "user", reviewStatus: "REVISION_COMPLETADA", reviewedAt: screening.createdAt,
        structuredObservations: { insufficientQuality: false, repeatedImageRecommended: false, newCaptureRequired: false, reviewCompleted: true, followUpRecommended: false, referralRecommended: false },
        notes: null, createdAt: screening.createdAt, updatedAt: screening.updatedAt, deletedAt: null, deletedBy: null,
      },
      followUps: [{
        id: "70000000-0000-4000-8000-000000000001", organizationId: screening.organizationId, patientId: screening.patientId,
        screeningId: screening.id, createdBy: "user", assignedTo: null, followUpType: "CONTROL_PROGRAMADO",
        followUpStatus: "SIN_SEGUIMIENTO", dueDate: null, completedAt: null, notes: null, createdAt: screening.createdAt,
        updatedAt: screening.updatedAt, deletedAt: null, deletedBy: null,
      }], referrals: [],
    };
    expect(buildClosureChecklist({ ...screening, qualityReviews }, completeWorkflow).canClose).toBe(true);
  });
});
