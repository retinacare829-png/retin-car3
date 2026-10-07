import { can } from "../domain/permissions";
import {
  professionalReportDisclaimer,
  professionalReportSchema,
  patientReportSchema,
  operationalReportFiltersSchema,
  operationalReportSchema,
  reportFiltersSchema,
  reportGenerationContextSchema,
  reportableScreeningStatuses,
  type ProfessionalReport,
  type PatientReport,
  type OperationalReport,
  type OperationalReportFilters,
  type ReportCandidate,
  type ReportFiltersInput,
} from "../domain/report";
import { structuredObservationsSchema } from "../domain/clinicalWorkflow";
import type { Role } from "../domain/roles";
import type { Database, TypedSupabaseClient } from "../lib/supabase";

type ScreeningRow = Database["public"]["Tables"]["screenings"]["Row"];
type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type RetinalImageRow = Database["public"]["Tables"]["retinal_images"]["Row"];
type QualityReviewRow = Database["public"]["Tables"]["image_quality_reviews"]["Row"];
type ProfessionalReviewRow = Database["public"]["Tables"]["professional_reviews"]["Row"];
type FollowUpRow = Database["public"]["Tables"]["follow_ups"]["Row"];
type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];

const reportPermissionError = new Error("Solo un administrador o profesional autorizado puede generar reportes.");
const reportNotAvailableError = new Error("El reporte solo está disponible para un screening revisado o cerrado.");

export class ReportService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listCandidates(filtersInput: ReportFiltersInput, actorRole: Role): Promise<ReportCandidate[]> {
    this.assertCanGenerate(actorRole);
    const filters = reportFiltersSchema.parse(filtersInput);

    let query = this.client
      .from("screenings")
      .select("id, organization_id, patient_id, status, created_at, closed_at")
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.screeningId) query = query.eq("id", filters.screeningId);
    if (filters.status) query = query.eq("status", filters.status);
    if (!filters.includeClosed) query = query.neq("status", "CERRADO");
    if (filters.createdFrom) query = query.gte("created_at", `${filters.createdFrom}T00:00:00.000Z`);
    if (filters.createdTo) query = query.lt("created_at", `${nextDate(filters.createdTo)}T00:00:00.000Z`);

    const { data: screeningRows, error: screeningError } = await query;
    if (screeningError) throw screeningError;
    const screenings = (screeningRows ?? []) as Array<Pick<ScreeningRow, "id" | "organization_id" | "patient_id" | "status" | "created_at" | "closed_at">>;
    if (screenings.length === 0) return [];

    const { data: patientRows, error: patientError } = await this.client
      .from("patients")
      .select("id, organization_id, internal_identifier, first_names, last_names")
      .eq("organization_id", filters.organizationId)
      .in("id", screenings.map((screening) => screening.patient_id))
      .is("deleted_at", null);
    if (patientError) throw patientError;

    const patients = new Map((patientRows ?? []).map((patient) => [patient.id, patient]));
    return screenings.flatMap((screening) => {
      const patient = patients.get(screening.patient_id);
      if (!patient) return [];
      return [{
        organizationId: screening.organization_id,
        patientId: screening.patient_id,
        screeningId: screening.id,
        patientName: `${patient.first_names} ${patient.last_names}`.trim(),
        internalIdentifier: patient.internal_identifier,
        screeningStatus: screening.status,
        createdAt: screening.created_at,
        closedAt: screening.closed_at,
      }];
    });
  }

  async generate(contextInput: unknown): Promise<ProfessionalReport> {
    const context = reportGenerationContextSchema.parse(contextInput);
    this.assertCanGenerate(context.actorRole);

    const [patientResult, screeningResult, imageResult, qualityResult, reviewResult, followUpResult, referralResult] = await Promise.all([
      this.client.from("patients").select("*").eq("organization_id", context.organizationId).eq("id", context.patientId).is("deleted_at", null).maybeSingle(),
      this.client.from("screenings").select("*").eq("organization_id", context.organizationId).eq("id", context.screeningId).eq("patient_id", context.patientId).is("deleted_at", null).maybeSingle(),
      this.client.from("retinal_images").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).order("created_at", { ascending: false }),
      this.client.from("image_quality_reviews").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).order("created_at", { ascending: false }),
      this.client.from("professional_reviews").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).maybeSingle(),
      this.client.from("follow_ups").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).order("created_at", { ascending: false }),
      this.client.from("referrals").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).order("created_at", { ascending: false }),
    ]);
    for (const result of [patientResult, screeningResult, imageResult, qualityResult, reviewResult, followUpResult, referralResult]) {
      if (result.error) throw result.error;
    }

    const patient = patientResult.data;
    const screening = screeningResult.data;
    if (!patient || !screening || !reportableScreeningStatuses.includes(screening.status as typeof reportableScreeningStatuses[number])) {
      throw reportNotAvailableError;
    }

    const images = (imageResult.data ?? []) as RetinalImageRow[];
    const qualityReviews = (qualityResult.data ?? []) as QualityReviewRow[];
    const qualityByImage = new Map<string, QualityReviewRow>();
    for (const review of qualityReviews) if (!qualityByImage.has(review.retinal_image_id)) qualityByImage.set(review.retinal_image_id, review);
    const professionalReview = reviewResult.data;
    const report = professionalReportSchema.parse({
      schemaVersion: 1,
      reportType: "SCREENING_SUMMARY",
      scope: "NON_DIAGNOSTIC",
      disclaimer: professionalReportDisclaimer,
      organizationId: context.organizationId,
      generatedBy: context.actorUserId,
      generatedAt: new Date().toISOString(),
      patient: {
        id: patient.id,
        internalIdentifier: patient.internal_identifier,
        medicalRecordCode: patient.medical_record_code,
        fullName: `${patient.first_names} ${patient.last_names}`.trim(),
        dateOfBirth: patient.date_of_birth,
        sex: patient.sex,
        diabetesType: patient.diabetes_type,
      },
      screening: {
        id: screening.id,
        status: screening.status,
        generalObservations: screening.general_observations,
        createdAt: screening.created_at,
        updatedAt: screening.updated_at,
        closedAt: screening.closed_at,
      },
      images: images
        .filter((image) => image.status === "ACTIVA")
        .map((image) => {
          const quality = qualityByImage.get(image.id);
          return {
            id: image.id,
            laterality: image.laterality,
            capturedAt: image.captured_at,
            mimeType: image.mime_type,
            sizeBytes: image.size_bytes,
            status: image.status,
            qualityStatus: quality?.quality_status ?? null,
            qualityReasons: quality?.reasons ?? [],
          };
        }),
      professionalReview: professionalReview ? {
        status: professionalReview.review_status,
        reviewedAt: professionalReview.reviewed_at,
        structuredObservations: structuredObservationsSchema.parse(professionalReview.structured_observations),
        notes: professionalReview.notes,
      } : null,
      followUps: ((followUpResult.data ?? []) as FollowUpRow[]).map((followUp) => ({
        type: followUp.follow_up_type,
        status: followUp.follow_up_status,
        dueDate: followUp.due_date,
        completedAt: followUp.completed_at,
        notes: followUp.notes,
      })),
      referrals: ((referralResult.data ?? []) as ReferralRow[]).map((referral) => ({
        reason: referral.referral_reason,
        destination: referral.referral_destination,
        status: referral.referral_status,
        requestedDate: referral.requested_date,
        completedDate: referral.completed_date,
        notes: referral.notes,
      })),
    });

    return report;
  }

  async getPatientReport(
    contextInput: { organizationId: string; patientId: string; actorUserId: string; actorRole: Role },
  ): Promise<PatientReport> {
    const context = reportGenerationContextSchema.pick({ organizationId: true, patientId: true, actorUserId: true, actorRole: true }).parse(contextInput);
    this.assertCanGenerate(context.actorRole);

    const [patientResult, screeningsResult] = await Promise.all([
      this.client.from("patients").select("*").eq("organization_id", context.organizationId).eq("id", context.patientId).is("deleted_at", null).maybeSingle(),
      this.client.from("screenings").select("*").eq("organization_id", context.organizationId).eq("patient_id", context.patientId).is("deleted_at", null).order("created_at", { ascending: false }),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (screeningsResult.error) throw screeningsResult.error;
    const patient = patientResult.data;
    const screenings = (screeningsResult.data ?? []) as ScreeningRow[];
    if (!patient) throw new Error("Paciente no encontrado en la organización activa.");
    if (screenings.length === 0) return this.buildPatientReport(context, patient, []);

    const screeningIds = screenings.map((screening) => screening.id);
    const [imagesResult, reviewsResult, followUpsResult, referralsResult] = await Promise.all([
      this.client.from("retinal_images").select("*").eq("organization_id", context.organizationId).in("screening_id", screeningIds).is("deleted_at", null),
      this.client.from("professional_reviews").select("*").eq("organization_id", context.organizationId).in("screening_id", screeningIds).is("deleted_at", null).order("created_at", { ascending: false }),
      this.client.from("follow_ups").select("*").eq("organization_id", context.organizationId).in("screening_id", screeningIds).is("deleted_at", null),
      this.client.from("referrals").select("*").eq("organization_id", context.organizationId).in("screening_id", screeningIds).is("deleted_at", null),
    ]);
    for (const result of [imagesResult, reviewsResult, followUpsResult, referralsResult]) if (result.error) throw result.error;

    const images = (imagesResult.data ?? []) as RetinalImageRow[];
    const reviews = (reviewsResult.data ?? []) as ProfessionalReviewRow[];
    const followUps = (followUpsResult.data ?? []) as FollowUpRow[];
    const referrals = (referralsResult.data ?? []) as ReferralRow[];
    return this.buildPatientReport(context, patient, screenings.map((screening) => ({
      screening,
      images: images.filter((image) => image.screening_id === screening.id && image.status === "ACTIVA"),
      review: reviews.find((review) => review.screening_id === screening.id) ?? null,
      followUps: followUps.filter((followUp) => followUp.screening_id === screening.id),
      referrals: referrals.filter((referral) => referral.screening_id === screening.id),
    })));
  }

  async getOperationalSummary(
    filtersInput: OperationalReportFilters,
    actorRole: Role,
    actorUserId: string,
  ): Promise<OperationalReport> {
    this.assertCanGenerate(actorRole);
    const filters = operationalReportFiltersSchema.parse(filtersInput);
    const start = `${filters.from}T00:00:00.000Z`;
    const end = `${nextDate(filters.to)}T00:00:00.000Z`;
    const [patientsResult, screeningsResult, reviewsResult, followUpsResult, referralsResult] = await Promise.all([
      this.client.from("patients").select("id").eq("organization_id", filters.organizationId).is("deleted_at", null).gte("created_at", start).lt("created_at", end),
      this.client.from("screenings").select("id, status").eq("organization_id", filters.organizationId).is("deleted_at", null).gte("created_at", start).lt("created_at", end),
      this.client.from("professional_reviews").select("id, review_status").eq("organization_id", filters.organizationId).is("deleted_at", null).gte("created_at", start).lt("created_at", end),
      this.client.from("follow_ups").select("id, follow_up_status").eq("organization_id", filters.organizationId).is("deleted_at", null).gte("created_at", start).lt("created_at", end),
      this.client.from("referrals").select("id, referral_status").eq("organization_id", filters.organizationId).is("deleted_at", null).gte("requested_date", filters.from).lte("requested_date", filters.to),
    ]);
    for (const result of [patientsResult, screeningsResult, reviewsResult, followUpsResult, referralsResult]) if (result.error) throw result.error;

    const screenings = (screeningsResult.data ?? []) as Array<Pick<ScreeningRow, "id" | "status">>;
    const reviews = (reviewsResult.data ?? []) as Array<Pick<ProfessionalReviewRow, "id" | "review_status">>;
    const followUps = (followUpsResult.data ?? []) as Array<Pick<FollowUpRow, "id" | "follow_up_status">>;
    const referrals = (referralsResult.data ?? []) as Array<Pick<ReferralRow, "id" | "referral_status">>;
    const statusMap = new Map<string, number>();
    for (const screening of screenings) statusMap.set(screening.status, (statusMap.get(screening.status) ?? 0) + 1);
    const screeningsByStatus = [...statusMap].map(([status, total]) => ({ status: status as ScreeningRow["status"], total }));
    const report = operationalReportSchema.parse({
      schemaVersion: 1,
      reportType: "OPERATIONAL_SUMMARY",
      scope: "NON_DIAGNOSTIC",
      disclaimer: professionalReportDisclaimer,
      organizationId: filters.organizationId,
      generatedBy: actorUserId,
      generatedAt: new Date().toISOString(),
      range: { from: filters.from, to: filters.to },
      totals: {
        newPatients: (patientsResult.data ?? []).length,
        screenings: screenings.length,
        completedScreenings: screenings.filter((screening) => ["REVISADO", "SEGUIMIENTO_REQUERIDO", "CERRADO"].includes(screening.status)).length,
        pendingReviews: reviews.filter((review) => ["PENDIENTE_REVISION", "EN_REVISION", "REQUIERE_RECAPTURA"].includes(review.review_status)).length,
        activeFollowUps: followUps.filter((followUp) => !["SEGUIMIENTO_COMPLETADO", "CANCELADO"].includes(followUp.follow_up_status)).length,
        activeReferrals: referrals.filter((referral) => !["COMPLETADA", "CANCELADA"].includes(referral.referral_status)).length,
      },
      screeningsByStatus,
    });
    return report;
  }

  private buildPatientReport(
    context: { organizationId: string; patientId: string; actorUserId: string },
    patient: PatientRow,
    entries: Array<{ screening: ScreeningRow; images: RetinalImageRow[]; review: ProfessionalReviewRow | null; followUps: FollowUpRow[]; referrals: ReferralRow[] }>,
  ): PatientReport {
    return patientReportSchema.parse({
      schemaVersion: 1,
      reportType: "PATIENT_SUMMARY",
      scope: "NON_DIAGNOSTIC",
      disclaimer: professionalReportDisclaimer,
      organizationId: context.organizationId,
      generatedBy: context.actorUserId,
      generatedAt: new Date().toISOString(),
      patient: {
        id: patient.id,
        internalIdentifier: patient.internal_identifier,
        medicalRecordCode: patient.medical_record_code,
        fullName: `${patient.first_names} ${patient.last_names}`.trim(),
        dateOfBirth: patient.date_of_birth,
        sex: patient.sex,
        diabetesType: patient.diabetes_type,
      },
      screenings: entries.map(({ screening, images, review, followUps, referrals }) => ({
        id: screening.id,
        status: screening.status,
        createdAt: screening.created_at,
        closedAt: screening.closed_at,
        professionalReviewStatus: review?.review_status ?? null,
        activeImages: {
          OD: images.filter((image) => image.laterality === "OD").length,
          OI: images.filter((image) => image.laterality === "OI").length,
        },
        followUps: followUps.length,
        referrals: referrals.length,
      })),
    });
  }

  private assertCanGenerate(actorRole: Role): void {
    // This is a UI/capability guard only. Tenant and row authorization remains Supabase RLS.
    if (!can(actorRole, "reports:generate")) throw reportPermissionError;
  }
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
