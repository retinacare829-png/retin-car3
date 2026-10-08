import type { Database, TypedSupabaseClient } from "../lib/supabase";
import type { ReportData } from "../domain/report";

type PatientRow = Pick<Database["public"]["Tables"]["patients"]["Row"], "id" | "internal_identifier" | "medical_record_code" | "first_names" | "last_names" | "date_of_birth" | "created_at">;
type ScreeningRow = Pick<Database["public"]["Tables"]["screenings"]["Row"], "id" | "patient_id" | "status" | "created_at" | "closed_at">;
type ReviewRow = Pick<Database["public"]["Tables"]["professional_reviews"]["Row"], "id" | "patient_id" | "screening_id" | "review_status" | "reviewed_at">;
type FollowUpRow = Pick<Database["public"]["Tables"]["follow_ups"]["Row"], "id" | "patient_id" | "screening_id" | "follow_up_type" | "follow_up_status" | "due_date">;
type ImageRow = Pick<Database["public"]["Tables"]["retinal_images"]["Row"], "id" | "patient_id" | "screening_id" | "laterality" | "status">;

export class ReportService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getReportData(organizationId: string): Promise<ReportData> {
    const [patientsResult, screeningsResult, reviewsResult, followUpsResult, imagesResult] = await Promise.all([
      this.client.from("patients").select("id, internal_identifier, medical_record_code, first_names, last_names, date_of_birth, created_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("screenings").select("id, patient_id, status, created_at, closed_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("professional_reviews").select("id, patient_id, screening_id, review_status, reviewed_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("follow_ups").select("id, patient_id, screening_id, follow_up_type, follow_up_status, due_date").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("retinal_images").select("id, patient_id, screening_id, laterality, status").eq("organization_id", organizationId).eq("status", "ACTIVA").is("deleted_at", null),
    ]);
    for (const result of [patientsResult, screeningsResult, reviewsResult, followUpsResult, imagesResult]) {
      if (result.error) throw result.error;
    }

    return {
      patients: (patientsResult.data ?? []).map((row: PatientRow) => ({ id: row.id, internalIdentifier: row.internal_identifier, medicalRecordCode: row.medical_record_code, firstNames: row.first_names, lastNames: row.last_names, dateOfBirth: row.date_of_birth, createdAt: row.created_at })),
      screenings: (screeningsResult.data ?? []).map((row: ScreeningRow) => ({ id: row.id, patientId: row.patient_id, status: row.status, createdAt: row.created_at, closedAt: row.closed_at })),
      reviews: (reviewsResult.data ?? []).map((row: ReviewRow) => ({ id: row.id, patientId: row.patient_id, screeningId: row.screening_id, reviewStatus: row.review_status, reviewedAt: row.reviewed_at })),
      followUps: (followUpsResult.data ?? []).map((row: FollowUpRow) => ({ id: row.id, patientId: row.patient_id, screeningId: row.screening_id, followUpType: row.follow_up_type, followUpStatus: row.follow_up_status, dueDate: row.due_date })),
      images: (imagesResult.data ?? []).map((row: ImageRow) => ({ id: row.id, patientId: row.patient_id, screeningId: row.screening_id, laterality: row.laterality, status: row.status })),
    };
  }
}
