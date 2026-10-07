import { describe, expect, it } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { PatientService } from "./patientService";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  actorUserId: "90000000-0000-4000-8000-000000000003",
};

const patientRow = {
  id: "20000000-0000-4000-8000-000000000099",
  organization_id: context.organizationId,
  internal_identifier: "RC-P-01000000",
  medical_record_code: null,
  first_names: "Paciente",
  last_names: "Demo",
  date_of_birth: "1970-01-01",
  sex: "unknown" as const,
  phone: "00000000",
  diabetes_diagnosis_date: null,
  diabetes_type: "unknown" as const,
  notes: null,
  created_by: context.actorUserId,
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
  created_at: "2026-10-06T00:00:00.000Z",
  updated_at: "2026-10-06T00:00:00.000Z",
};

const editableData = {
  firstNames: "Paciente",
  lastNames: "Demo",
  dateOfBirth: "1970-01-01",
  sex: "unknown" as const,
  phone: "00000000",
  diabetesDiagnosisDate: null,
  diabetesType: "unknown" as const,
  notes: null,
};

describe("PatientService", () => {
  it("creates through the atomic RPC without accepting client codes", async () => {
    let rpcArgs: Record<string, unknown> | null = null;
    const client = createClient({
      rpc: (name, args) => {
        expect(name).toBe("create_patient");
        rpcArgs = args;
        return Promise.resolve({ data: patientRow, error: null });
      },
      row: patientRow,
    });

    const patient = await new PatientService(client).createPatient(
      context,
      editableData,
      "70000000-0000-4000-8000-000000000001",
    );

    expect(patient.internalIdentifier).toBe("RC-P-01000000");
    expect(patient.medicalRecordCode).toBeNull();
    expect(rpcArgs).not.toHaveProperty("internal_identifier");
    expect(rpcArgs).not.toHaveProperty("medical_record_code");
    expect(rpcArgs).toMatchObject({ target_request_id: "70000000-0000-4000-8000-000000000001" });
  });

  it("does not send identifiers when editing an existing patient", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    const client = createClient({
      row: { ...patientRow, first_names: "Paciente Editado" },
      update: (payload) => { updatePayload = payload; },
    });

    const updated = await new PatientService(client).updatePatient(context, {
      ...mapPatient(patientRow),
    }, { ...editableData, firstNames: "Paciente Editado" });

    expect(updated.internalIdentifier).toBe(patientRow.internal_identifier);
    expect(updated.medicalRecordCode).toBe(patientRow.medical_record_code);
    expect(updatePayload).not.toHaveProperty("internal_identifier");
    expect(updatePayload).not.toHaveProperty("medical_record_code");
  });
});

function mapPatient(row: typeof patientRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    internalIdentifier: row.internal_identifier,
    medicalRecordCode: row.medical_record_code,
    firstNames: row.first_names,
    lastNames: row.last_names,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    phone: row.phone,
    diabetesDiagnosisDate: row.diabetes_diagnosis_date,
    diabetesType: row.diabetes_type,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createClient(options: {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: typeof patientRow | null; error: null }>;
  row: typeof patientRow;
  update?: (payload: Record<string, unknown>) => void;
}): TypedSupabaseClient {
  return {
    rpc: options.rpc ?? (() => Promise.resolve({ data: options.row, error: null })),
    from(table: string) {
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        update: (payload: Record<string, unknown>) => {
          options.update?.(payload);
          return query;
        },
        insert: () => ({ error: null }),
        single: () => Promise.resolve({ data: table === "patients" ? options.row : null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    },
  } as unknown as TypedSupabaseClient;
}
