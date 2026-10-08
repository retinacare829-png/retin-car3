import { getChangedPatientFields, patientCreateSchema, patientUpdateSchema, type Patient, type PatientCodePreview, type PatientCreateData, type PatientUpdateData } from "../domain/patient";
import type { PatientPortalAccount } from "../domain/patientPortal";
import type { Database, TypedSupabaseClient } from "../lib/supabase";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type PatientPortalAccountRow = Database["public"]["Tables"]["patient_accounts"]["Row"];
type PatientAction = "patient.created" | "patient.updated" | "patient.archived" | "patient.restored";

export interface PatientListOptions {
  organizationId: string;
  includeArchived: boolean;
  query?: string;
}

export interface PatientMutationContext {
  organizationId: string;
  actorUserId: string;
}

export class PatientService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listPatients(options: PatientListOptions): Promise<Patient[]> {
    let query = this.client
      .from("patients")
      .select("*")
      .eq("organization_id", options.organizationId)
      .order("last_names", { ascending: true })
      .order("first_names", { ascending: true });

    if (!options.includeArchived) {
      query = query.is("deleted_at", null);
    }

    if (options.query?.trim()) {
      const term = options.query.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
      query = query.or(
        `internal_identifier.ilike.%${term}%,medical_record_code.ilike.%${term}%,first_names.ilike.%${term}%,last_names.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map(mapPatientRow);
  }

  async previewPatientCodes(organizationId: string): Promise<PatientCodePreview> {
    const { data, error } = await this.client.rpc("preview_patient_codes", {
      target_organization_id: organizationId,
    });
    if (error) throw error;
    const preview = data?.[0];
    if (!preview) throw new Error("No se pudo obtener la vista previa de códigos.");
    return {
      internalIdentifier: preview.internal_identifier,
      recordCode: preview.record_code,
      provisional: true,
    };
  }

  async getPatientPortalAccount(context: PatientMutationContext, patientId: string): Promise<PatientPortalAccount | null> {
    const { data, error } = await this.client
      .from("patient_accounts")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPatientPortalAccountRow(data) : null;
  }

  async linkPatientPortalAccount(
    context: PatientMutationContext,
    patientId: string,
    userId: string,
  ): Promise<PatientPortalAccount> {
    const { data, error } = await this.client.rpc("link_patient_account", {
      target_organization_id: context.organizationId,
      target_patient_id: patientId,
      target_user_id: userId,
    });

    if (error) throw error;
    return mapPatientPortalAccountRow(data);
  }

  async revokePatientPortalAccount(
    context: PatientMutationContext,
    patientId: string,
  ): Promise<PatientPortalAccount> {
    const { data, error } = await this.client.rpc("revoke_patient_account", {
      target_organization_id: context.organizationId,
      target_patient_id: patientId,
    });

    if (error) throw error;
    return mapPatientPortalAccountRow(data);
  }

  async createPatient(context: PatientMutationContext, formData: PatientCreateData, requestId?: string): Promise<Patient> {
    const data = patientCreateSchema.parse(formData);
    const { data: inserted, error } = await this.client.rpc("create_patient", {
      target_organization_id: context.organizationId,
      target_first_names: data.firstNames,
      target_last_names: data.lastNames,
      target_date_of_birth: data.dateOfBirth,
      target_sex: data.sex,
      target_phone: data.phone,
      target_diabetes_diagnosis_date: data.diabetesDiagnosisDate,
      target_diabetes_type: data.diabetesType,
      target_notes: data.notes,
      target_request_id: requestId ?? null,
    });

    if (error) {
      throw error;
    }
    return mapPatientRow(inserted);
  }

  async updatePatient(context: PatientMutationContext, patient: Patient, formData: PatientUpdateData): Promise<Patient> {
    const data = patientUpdateSchema.parse(formData);
    const changedFields = getChangedPatientFields(patient, data);

    const { data: updated, error } = await this.client
      .from("patients")
      .update({
        first_names: data.firstNames,
        last_names: data.lastNames,
        date_of_birth: data.dateOfBirth,
        sex: data.sex,
        phone: data.phone,
        diabetes_diagnosis_date: data.diabetesDiagnosisDate,
        diabetes_type: data.diabetesType,
        notes: data.notes,
        updated_by: context.actorUserId,
      })
      .eq("id", patient.id)
      .eq("organization_id", context.organizationId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const mapped = mapPatientRow(updated);
    if (changedFields.length > 0) {
      await this.recordPatientChange(context, patient.id, "patient.updated", changedFields, "Ficha actualizada");
    }
    return mapped;
  }

  async archivePatient(context: PatientMutationContext, patientId: string): Promise<void> {
    const { error } = await this.client
      .from("patients")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.actorUserId,
        updated_by: context.actorUserId,
      })
      .eq("id", patientId)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }

    await this.recordPatientChange(context, patientId, "patient.archived", ["deletedAt"], "Ficha archivada");
  }

  async restorePatient(context: PatientMutationContext, patientId: string): Promise<void> {
    const { error } = await this.client
      .from("patients")
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_by: context.actorUserId,
      })
      .eq("id", patientId)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }

    await this.recordPatientChange(context, patientId, "patient.restored", ["deletedAt"], "Ficha restaurada");
  }

  private async recordPatientChange(
    context: PatientMutationContext,
    patientId: string,
    action: PatientAction,
    changedFields: string[],
    timelineTitle: string,
  ): Promise<void> {
    const metadata = { changed_fields_count: changedFields.length };

    const [{ error: auditError }, { error: timelineError }] = await Promise.all([
      this.client.from("audit_logs").insert({
        organization_id: context.organizationId,
        actor_user_id: context.actorUserId,
        action,
        entity_type: "patient",
        entity_id: patientId,
        changed_fields: changedFields,
        metadata,
      }),
      this.client.from("patient_timeline_events").insert({
        organization_id: context.organizationId,
        patient_id: patientId,
        event_type: action,
        title: timelineTitle,
        actor_user_id: context.actorUserId,
        metadata,
      }),
    ]);

    if (auditError) {
      throw auditError;
    }

    if (timelineError) {
      throw timelineError;
    }
  }
}

function mapPatientRow(row: PatientRow): Patient {
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

function mapPatientPortalAccountRow(row: PatientPortalAccountRow): PatientPortalAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    userId: row.user_id,
    status: row.status,
    createdBy: row.created_by,
    revokedBy: row.revoked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}
