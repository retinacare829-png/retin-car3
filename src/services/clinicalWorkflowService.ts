import {
  followUpSchema,
  professionalReviewSchema,
  referralSchema,
  structuredObservationsSchema,
  type ClinicalWorkflowDetail,
  type FollowUp,
  type FollowUpData,
  type ProfessionalReview,
  type ProfessionalReviewData,
  type Referral,
  type ReferralData,
} from "../domain/clinicalWorkflow";
import type { Database, TypedSupabaseClient } from "../lib/supabase";

type AuditAction = Database["public"]["Enums"]["audit_action"];
type TimelineEventType = Database["public"]["Enums"]["patient_timeline_event_type"];
type ReviewRow = Database["public"]["Tables"]["professional_reviews"]["Row"];
type FollowUpRow = Database["public"]["Tables"]["follow_ups"]["Row"];
type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];
type SafeMetadata = Record<string, string | number | boolean | null>;

export interface ClinicalWorkflowContext {
  organizationId: string;
  patientId: string;
  screeningId: string;
  actorUserId: string;
}

export class ClinicalWorkflowService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getDetail(context: Pick<ClinicalWorkflowContext, "organizationId" | "screeningId">): Promise<ClinicalWorkflowDetail> {
    const [reviewResult, followUpResult, referralResult] = await Promise.all([
      this.client.from("professional_reviews").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).maybeSingle(),
      this.client.from("follow_ups").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).order("created_at", { ascending: false }),
      this.client.from("referrals").select("*").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).order("created_at", { ascending: false }),
    ]);
    if (reviewResult.error) throw reviewResult.error;
    if (followUpResult.error) throw followUpResult.error;
    if (referralResult.error) throw referralResult.error;
    return {
      professionalReview: reviewResult.data ? mapReview(reviewResult.data) : null,
      followUps: (followUpResult.data ?? []).map(mapFollowUp),
      referrals: (referralResult.data ?? []).map(mapReferral),
    };
  }

  async saveProfessionalReview(context: ClinicalWorkflowContext, input: ProfessionalReviewData): Promise<ProfessionalReview> {
    const data = professionalReviewSchema.parse(input);
    const existing = await this.client.from("professional_reviews").select("id, review_status").eq("organization_id", context.organizationId).eq("screening_id", context.screeningId).is("deleted_at", null).maybeSingle();
    if (existing.error) throw existing.error;
    const reviewedAt = ["REVISION_COMPLETADA", "SEGUIMIENTO_REQUERIDO", "CERRADO"].includes(data.reviewStatus)
      ? new Date().toISOString()
      : null;
    const payload = {
      organization_id: context.organizationId,
      patient_id: context.patientId,
      screening_id: context.screeningId,
      reviewer_user_id: context.actorUserId,
      review_status: data.reviewStatus,
      reviewed_at: reviewedAt,
      structured_observations: data.structuredObservations,
      notes: data.notes,
    };
    const result = existing.data
      ? await this.client.from("professional_reviews").update(payload).eq("id", existing.data.id).eq("organization_id", context.organizationId).select("*").single()
      : await this.client.from("professional_reviews").insert(payload).select("*").single();
    if (result.error) throw result.error;
    const saved = mapReview(result.data);
    const action = existing.data ? "professional_review.updated" : "professional_review.created";
    const statusChanged = existing.data?.review_status !== saved.reviewStatus;
    await this.audit(context, action, "professional_review", saved.id, existing.data ? ["reviewStatus", "structuredObservations", "notes"] : ["created"], { review_status: saved.reviewStatus });
    if (!existing.data || statusChanged) {
      await this.timeline(context, action, reviewTimelineTitle(saved.reviewStatus), { review_status: saved.reviewStatus });
    }
    return saved;
  }

  async createFollowUp(context: ClinicalWorkflowContext, input: FollowUpData): Promise<FollowUp> {
    const data = followUpSchema.parse(input);
    const { data: row, error } = await this.client.from("follow_ups").insert({
      organization_id: context.organizationId, patient_id: context.patientId, screening_id: context.screeningId,
      created_by: context.actorUserId, assigned_to: data.assignedTo, follow_up_type: data.followUpType,
      follow_up_status: data.followUpStatus, due_date: data.dueDate, completed_at: data.completedAt, notes: data.notes,
    }).select("*").single();
    if (error) throw error;
    const saved = mapFollowUp(row);
    await this.audit(context, "follow_up.created", "follow_up", saved.id, ["created"], { follow_up_type: saved.followUpType, follow_up_status: saved.followUpStatus });
    await this.timeline(context, "follow_up.created", "Seguimiento creado", { follow_up_status: saved.followUpStatus });
    return saved;
  }

  async updateFollowUp(context: ClinicalWorkflowContext, followUp: FollowUp, input: FollowUpData): Promise<FollowUp> {
    const data = followUpSchema.parse(input);
    const { data: row, error } = await this.client.from("follow_ups").update({
      assigned_to: data.assignedTo, follow_up_type: data.followUpType, follow_up_status: data.followUpStatus,
      due_date: data.dueDate, completed_at: data.completedAt, notes: data.notes,
    }).eq("id", followUp.id).eq("organization_id", context.organizationId).select("*").single();
    if (error) throw error;
    const saved = mapFollowUp(row);
    await this.audit(context, "follow_up.updated", "follow_up", saved.id, ["followUpType", "followUpStatus", "dueDate", "assignedTo", "notes"], { follow_up_status: saved.followUpStatus });
    if (followUp.followUpStatus !== "SEGUIMIENTO_COMPLETADO" && saved.followUpStatus === "SEGUIMIENTO_COMPLETADO") {
      await this.timeline(context, "follow_up.updated", "Seguimiento completado", { follow_up_status: saved.followUpStatus });
    }
    return saved;
  }

  async createReferral(context: ClinicalWorkflowContext, input: ReferralData): Promise<Referral> {
    const data = referralSchema.parse(input);
    const { data: row, error } = await this.client.from("referrals").insert({
      organization_id: context.organizationId, patient_id: context.patientId, screening_id: context.screeningId,
      created_by: context.actorUserId, referral_reason: data.referralReason, referral_destination: data.referralDestination,
      referral_status: data.referralStatus, requested_date: data.requestedDate, completed_date: data.completedDate, notes: data.notes,
    }).select("*").single();
    if (error) throw error;
    const saved = mapReferral(row);
    await this.audit(context, "referral.created", "referral", saved.id, ["created"], { referral_status: saved.referralStatus });
    await this.timeline(context, "referral.created", "Referencia creada", { referral_status: saved.referralStatus });
    return saved;
  }

  async updateReferral(context: ClinicalWorkflowContext, referral: Referral, input: ReferralData): Promise<Referral> {
    const data = referralSchema.parse(input);
    const { data: row, error } = await this.client.from("referrals").update({
      referral_reason: data.referralReason, referral_destination: data.referralDestination,
      referral_status: data.referralStatus, requested_date: data.requestedDate, completed_date: data.completedDate, notes: data.notes,
    }).eq("id", referral.id).eq("organization_id", context.organizationId).select("*").single();
    if (error) throw error;
    const saved = mapReferral(row);
    await this.audit(context, "referral.updated", "referral", saved.id, ["referralReason", "referralDestination", "referralStatus", "requestedDate", "notes"], { referral_status: saved.referralStatus });
    return saved;
  }

  async closeScreening(context: ClinicalWorkflowContext): Promise<void> {
    const { error } = await this.client.rpc("close_screening_workflow", {
      target_organization_id: context.organizationId,
      target_patient_id: context.patientId,
      target_screening_id: context.screeningId,
    });
    if (error) throw error;
  }

  private async audit(context: ClinicalWorkflowContext, action: AuditAction, entityType: string, entityId: string, changedFields: string[], metadata: SafeMetadata) {
    const { error } = await this.client.from("audit_logs").insert({ organization_id: context.organizationId, actor_user_id: context.actorUserId, action, entity_type: entityType, entity_id: entityId, changed_fields: changedFields, metadata });
    if (error) throw error;
  }

  private async timeline(context: ClinicalWorkflowContext, eventType: TimelineEventType, title: string, metadata: SafeMetadata) {
    const { error } = await this.client.from("patient_timeline_events").insert({ organization_id: context.organizationId, patient_id: context.patientId, event_type: eventType, title, actor_user_id: context.actorUserId, metadata });
    if (error) throw error;
  }
}

function reviewTimelineTitle(status: ProfessionalReview["reviewStatus"]): string {
  if (status === "EN_REVISION") return "Revision iniciada";
  if (status === "REQUIERE_RECAPTURA") return "Recaptura solicitada";
  if (status === "REVISION_COMPLETADA" || status === "SEGUIMIENTO_REQUERIDO") return "Revision completada";
  return "Revision profesional registrada";
}

function mapReview(row: ReviewRow): ProfessionalReview {
  return { id: row.id, organizationId: row.organization_id, patientId: row.patient_id, screeningId: row.screening_id, reviewerUserId: row.reviewer_user_id, reviewStatus: row.review_status, reviewedAt: row.reviewed_at, structuredObservations: structuredObservationsSchema.parse(row.structured_observations), notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at, deletedBy: row.deleted_by };
}
function mapFollowUp(row: FollowUpRow): FollowUp {
  return { id: row.id, organizationId: row.organization_id, patientId: row.patient_id, screeningId: row.screening_id, createdBy: row.created_by, assignedTo: row.assigned_to, followUpType: row.follow_up_type, followUpStatus: row.follow_up_status, dueDate: row.due_date, completedAt: row.completed_at, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at, deletedBy: row.deleted_by };
}
function mapReferral(row: ReferralRow): Referral {
  return { id: row.id, organizationId: row.organization_id, patientId: row.patient_id, screeningId: row.screening_id, createdBy: row.created_by, referralReason: row.referral_reason, referralDestination: row.referral_destination, referralStatus: row.referral_status, requestedDate: row.requested_date, completedDate: row.completed_date, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at, deletedBy: row.deleted_by };
}
