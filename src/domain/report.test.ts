import { describe, expect, it } from "vitest";
import { professionalReportDisclaimer, professionalReportSchema, reportFiltersSchema } from "./report";

describe("report domain contract", () => {
  it("requires an organization and normalizes optional filters", () => {
    expect(reportFiltersSchema.parse({
      organizationId: "10000000-0000-4000-8000-000000000001",
    })).toMatchObject({
      organizationId: "10000000-0000-4000-8000-000000000001",
      includeClosed: true,
    });
  });

  it("rejects an inverted date range", () => {
    expect(() => reportFiltersSchema.parse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      createdFrom: "2026-10-10",
      createdTo: "2026-10-01",
    })).toThrow();
  });

  it("does not accept diagnostic fields in a professional report", () => {
    expect(() => professionalReportSchema.parse({
      schemaVersion: 1,
      reportType: "SCREENING_SUMMARY",
      scope: "NON_DIAGNOSTIC",
      disclaimer: professionalReportDisclaimer,
      organizationId: "10000000-0000-4000-8000-000000000001",
      generatedBy: "40000000-0000-4000-8000-000000000001",
      generatedAt: "2026-10-06T12:00:00.000Z",
      diagnosis: "retinopathy",
      patient: {
        id: "20000000-0000-4000-8000-000000000001", internalIdentifier: "P-1", medicalRecordCode: "E-1",
        fullName: "Paciente Demo", dateOfBirth: "1970-01-01", sex: "unknown", diabetesType: "unknown",
      },
      screening: {
        id: "30000000-0000-4000-8000-000000000001", recordCode: "EXP-01000000", status: "REVISADO", generalObservations: null,
        createdAt: "2026-10-06T10:00:00.000Z", updatedAt: "2026-10-06T11:00:00.000Z", closedAt: null,
      },
      images: [], professionalReview: null, followUps: [], referrals: [],
    })).toThrow();
  });
});
