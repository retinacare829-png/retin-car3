import { describe, expect, it } from "vitest";
import {
  defaultPatientFilters,
  filterPatients,
  getChangedPatientFields,
  patientCreateSchema,
  patientFormSchema,
  type Patient,
} from "./patient";

const patient: Patient = {
  id: "patient-1",
  organizationId: "clinic-1",
  internalIdentifier: "DEMO-001",
  medicalRecordCode: "EXP-001",
  firstNames: "Ana Maria",
  lastNames: "Solis Perez",
  dateOfBirth: "1970-01-10",
  sex: "female",
  phone: "+505 8888 0001",
  diabetesDiagnosisDate: "2015-02-01",
  diabetesType: "type_2",
  notes: "Ficticio",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
};

describe("patient validation", () => {
  it("accepts creation data without client-provided identifiers", () => {
    const result = patientCreateSchema.safeParse({
      firstNames: "Luis Alberto",
      lastNames: "Rojas Cano",
      dateOfBirth: "1962-03-15",
      sex: "male",
      phone: "",
      diabetesDiagnosisDate: "",
      diabetesType: "unknown",
      notes: "",
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data : null).not.toHaveProperty("internalIdentifier");
    expect(result.success ? result.data : null).not.toHaveProperty("medicalRecordCode");
  });

  it("accepts a valid fictitious patient form", () => {
    const result = patientFormSchema.safeParse({
      internalIdentifier: "DEMO-002",
      medicalRecordCode: "EXP-002",
      firstNames: "Luis Alberto",
      lastNames: "Rojas Cano",
      dateOfBirth: "1962-03-15",
      sex: "male",
      phone: "",
      diabetesDiagnosisDate: "",
      diabetesType: "unknown",
      notes: "",
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.phone : null).toBeNull();
  });

  it("rejects diabetes diagnosis dates before birth", () => {
    const result = patientFormSchema.safeParse({
      internalIdentifier: "DEMO-003",
      medicalRecordCode: "EXP-003",
      firstNames: "Rosa",
      lastNames: "Molina",
      dateOfBirth: "1980-01-01",
      sex: "female",
      phone: "",
      diabetesDiagnosisDate: "1979-12-31",
      diabetesType: "type_2",
      notes: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("patient filtering and audit helpers", () => {
  it("filters active patients by query and hides archived records by default", () => {
    const archived = { ...patient, id: "patient-2", deletedAt: "2026-01-02T00:00:00.000Z" };

    expect(filterPatients([patient, archived], { ...defaultPatientFilters, query: "solis" })).toHaveLength(1);
    expect(
      filterPatients([patient, archived], {
        ...defaultPatientFilters,
        query: "solis",
        includeArchived: true,
      }),
    ).toHaveLength(2);
  });

  it("returns changed fields without clinical interpretation", () => {
    const changed = getChangedPatientFields(patient, {
      firstNames: "Ana",
      lastNames: patient.lastNames,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      phone: patient.phone,
      diabetesDiagnosisDate: patient.diabetesDiagnosisDate,
      diabetesType: "unknown",
      notes: patient.notes,
    });

    expect(changed).toEqual(["firstNames", "diabetesType"]);
  });
});
