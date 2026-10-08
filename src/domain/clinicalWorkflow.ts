import { z } from "zod";
import type { ScreeningDetail } from "./screening";

export const professionalReviewStatusValues = [
  "PENDIENTE_REVISION",
  "EN_REVISION",
  "REVISION_COMPLETADA",
  "REQUIERE_RECAPTURA",
  "SEGUIMIENTO_REQUERIDO",
  "CERRADO",
] as const;

export const followUpTypeValues = ["CONTROL_PROGRAMADO", "REPETIR_ESTUDIO", "REFERIR_OFTALMOLOGIA"] as const;
export const followUpStatusValues = [
  "SIN_SEGUIMIENTO",
  "CONTROL_PROGRAMADO",
  "REPETIR_ESTUDIO",
  "REFERIR_OFTALMOLOGIA",
  "SEGUIMIENTO_COMPLETADO",
  "CANCELADO",
] as const;
export const followUpUrgencyValues = ["normal", "urgent"] as const;
export const referralStatusValues = ["BORRADOR", "SOLICITADA", "EN_PROCESO", "COMPLETADA", "CANCELADA"] as const;

export type ProfessionalReviewStatus = (typeof professionalReviewStatusValues)[number];
export type FollowUpType = (typeof followUpTypeValues)[number];
export type FollowUpStatus = (typeof followUpStatusValues)[number];
export type ReferralStatus = (typeof referralStatusValues)[number];

export const professionalReviewStatusLabels: Record<ProfessionalReviewStatus, string> = {
  PENDIENTE_REVISION: "Pendiente de revision",
  EN_REVISION: "En revision",
  REVISION_COMPLETADA: "Revision completada",
  REQUIERE_RECAPTURA: "Requiere recaptura",
  SEGUIMIENTO_REQUERIDO: "Seguimiento requerido",
  CERRADO: "Cerrado",
};

export const followUpTypeLabels: Record<FollowUpType, string> = {
  CONTROL_PROGRAMADO: "Control programado",
  REPETIR_ESTUDIO: "Repetir estudio",
  REFERIR_OFTALMOLOGIA: "Referir a oftalmologia",
};

export const followUpStatusLabels: Record<FollowUpStatus, string> = {
  SIN_SEGUIMIENTO: "Sin seguimiento",
  CONTROL_PROGRAMADO: "Control programado",
  REPETIR_ESTUDIO: "Repetir estudio",
  REFERIR_OFTALMOLOGIA: "Referir a oftalmologia",
  SEGUIMIENTO_COMPLETADO: "Seguimiento completado",
  CANCELADO: "Cancelado",
};

export const referralStatusLabels: Record<ReferralStatus, string> = {
  BORRADOR: "Borrador",
  SOLICITADA: "Solicitada",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullish().transform((value) => value || null);
const optionalUuid = z.string().trim().nullish().transform((value) => value || null).pipe(z.string().uuid().nullable());
const optionalDate = z.string().trim().nullish().transform((value) => value || null).pipe(z.string().date().nullable());

export const structuredObservationsSchema = z.object({
  insufficientQuality: z.boolean().default(false),
  repeatedImageRecommended: z.boolean().default(false),
  newCaptureRequired: z.boolean().default(false),
  reviewCompleted: z.boolean().default(false),
  followUpRecommended: z.boolean().default(false),
  referralRecommended: z.boolean().default(false),
});

export const professionalReviewSchema = z.object({
  reviewStatus: z.enum(professionalReviewStatusValues),
  structuredObservations: structuredObservationsSchema,
  notes: optionalText(1600),
});

export const followUpSchema = z.object({
  assignedTo: optionalUuid,
  followUpType: z.enum(followUpTypeValues),
  followUpStatus: z.enum(followUpStatusValues),
  urgency: z.enum(followUpUrgencyValues).default("normal"),
  dueDate: optionalDate,
  completedAt: z.string().datetime().nullable().optional().default(null),
  notes: optionalText(1200),
});

export const referralSchema = z.object({
  referralReason: z.string().trim().min(2).max(500),
  referralDestination: z.string().trim().min(2).max(300),
  referralStatus: z.enum(referralStatusValues),
  requestedDate: z.string().date(),
  completedDate: optionalDate,
  notes: optionalText(1200),
});

export type StructuredObservations = z.infer<typeof structuredObservationsSchema>;
export type ProfessionalReviewInput = z.input<typeof professionalReviewSchema>;
export type ProfessionalReviewData = z.output<typeof professionalReviewSchema>;
export type FollowUpInput = z.input<typeof followUpSchema>;
export type FollowUpData = z.output<typeof followUpSchema>;
export type ReferralInput = z.input<typeof referralSchema>;
export type ReferralData = z.output<typeof referralSchema>;

interface WorkflowEntityBase {
  id: string;
  organizationId: string;
  patientId: string;
  screeningId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProfessionalReview extends WorkflowEntityBase, ProfessionalReviewData {
  reviewerUserId: string;
  reviewedAt: string | null;
  deletedBy: string | null;
}

export interface FollowUp extends WorkflowEntityBase, FollowUpData {
  createdBy: string;
  deletedBy: string | null;
}

export interface Referral extends WorkflowEntityBase, ReferralData {
  createdBy: string;
  deletedBy: string | null;
}

export interface ClinicalWorkflowDetail {
  professionalReview: ProfessionalReview | null;
  followUps: FollowUp[];
  referrals: Referral[];
}

export interface ClosureChecklistItem {
  key: string;
  label: string;
  complete: boolean;
}

export interface ClosureChecklist {
  canClose: boolean;
  items: ClosureChecklistItem[];
  missing: string[];
}

export function buildClosureChecklist(
  screening: ScreeningDetail,
  workflow: ClinicalWorkflowDetail,
): ClosureChecklist {
  const activeImages = screening.images.filter((image) => image.status === "ACTIVA" && !image.deletedAt);
  const imageFor = (laterality: "OD" | "OI") => activeImages.find((image) => image.laterality === laterality);
  const hasQualityFor = (laterality: "OD" | "OI") => {
    const image = imageFor(laterality);
    return Boolean(
      image && screening.qualityReviews.some(
        (review) => review.retinalImageId === image.id && review.qualityStatus !== "PENDIENTE",
      ),
    );
  };
  const reviewCompleted = ["REVISION_COMPLETADA", "SEGUIMIENTO_REQUERIDO"].includes(
    workflow.professionalReview?.reviewStatus ?? "",
  );
  const decisionRecorded = workflow.followUps.length > 0 || workflow.referrals.length > 0;

  const items: ClosureChecklistItem[] = [
    { key: "patient", label: "Paciente seleccionado", complete: Boolean(screening.patientId) },
    { key: "screening", label: "Screening creado", complete: Boolean(screening.id) },
    { key: "image_od", label: "Imagen OD cargada", complete: Boolean(imageFor("OD")) },
    { key: "image_oi", label: "Imagen OI cargada", complete: Boolean(imageFor("OI")) },
    { key: "quality_od", label: "Calidad OD registrada", complete: hasQualityFor("OD") },
    { key: "quality_oi", label: "Calidad OI registrada", complete: hasQualityFor("OI") },
    { key: "review", label: "Revision profesional completada", complete: reviewCompleted },
    { key: "decision", label: "Seguimiento o decision registrada", complete: decisionRecorded },
  ];

  return { canClose: items.every((item) => item.complete), items, missing: items.filter((item) => !item.complete).map((item) => item.label) };
}
