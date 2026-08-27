import { describe, expect, it } from "vitest";
import {
  betaAiUnavailableMessage,
  getChangedScreeningFields,
  getQualitySuggestion,
  imageQualityReviewSchema,
  repeatCaptureSuggestion,
  screeningFormSchema,
  type Screening,
} from "./screening";

const screening: Screening = {
  id: "30000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
  patientId: "20000000-0000-4000-8000-000000000001",
  status: "BORRADOR",
  generalObservations: null,
  assignedReviewerId: null,
  createdBy: "user-1",
  updatedBy: null,
  closedAt: null,
  closedBy: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("screening validation", () => {
  it("accepts beta workflow states without diagnostic states", () => {
    const parsed = screeningFormSchema.safeParse({
      patientId: screening.patientId,
      status: "CAPTURA_PENDIENTE",
      generalObservations: "",
      assignedReviewerId: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.generalObservations : "unexpected").toBeNull();
  });

  it("rejects clinical diagnosis-like states", () => {
    const parsed = screeningFormSchema.safeParse({
      patientId: screening.patientId,
      status: "POSITIVO",
      generalObservations: "",
      assignedReviewerId: "",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("image quality", () => {
  it("requires a reason when quality is inadequate and suggests repeating capture", () => {
    expect(
      imageQualityReviewSchema.safeParse({
        retinalImageId: "30000000-0000-4000-8000-000000000010",
        qualityStatus: "INADECUADA",
        reasons: [],
        otherReason: "",
      }).success,
    ).toBe(false);

    expect(getQualitySuggestion("INADECUADA")).toBe(repeatCaptureSuggestion);
  });

  it("keeps the AI unavailable message explicit", () => {
    expect(betaAiUnavailableMessage).toBe("Modulo de Inteligencia Artificial no disponible en esta version beta.");
  });
});

describe("screening audit helpers", () => {
  it("returns changed fields without clinical interpretation", () => {
    expect(
      getChangedScreeningFields(screening, {
        patientId: screening.patientId,
        status: "PENDIENTE_REVISION",
        generalObservations: "Pendiente de lectura profesional.",
        assignedReviewerId: null,
      }),
    ).toEqual(["status", "generalObservations"]);
  });
});
