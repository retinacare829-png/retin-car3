import { z } from "zod";

export const screeningStatusValues = [
  "BORRADOR",
  "CAPTURA_PENDIENTE",
  "IMAGENES_COMPLETAS",
  "PENDIENTE_REVISION",
  "REVISADO",
  "SEGUIMIENTO_REQUERIDO",
  "CERRADO",
] as const;

export const retinalImageLateralityValues = ["OD", "OI"] as const;
export const retinalImageStatusValues = ["ACTIVA", "REEMPLAZADA", "ELIMINADA"] as const;
export const imageQualityStatusValues = ["PENDIENTE", "ADECUADA", "INADECUADA"] as const;
export const imageQualityReasonValues = ["DESENFOQUE", "REFLEJO", "MALA_ILUMINACION", "CAMPO_INCOMPLETO", "MOVIMIENTO", "OTRO"] as const;

export type ScreeningStatus = (typeof screeningStatusValues)[number];
export type RetinalImageLaterality = (typeof retinalImageLateralityValues)[number];
export type RetinalImageStatus = (typeof retinalImageStatusValues)[number];
export type ImageQualityStatus = (typeof imageQualityStatusValues)[number];
export type ImageQualityReason = (typeof imageQualityReasonValues)[number];

export const screeningStatusLabels: Record<ScreeningStatus, string> = {
  BORRADOR: "Borrador",
  CAPTURA_PENDIENTE: "Captura pendiente",
  IMAGENES_COMPLETAS: "Imagenes completas",
  PENDIENTE_REVISION: "Pendiente de revision",
  REVISADO: "Revisado",
  SEGUIMIENTO_REQUERIDO: "Seguimiento requerido",
  CERRADO: "Cerrado",
};

export const retinalImageLateralityLabels: Record<RetinalImageLaterality, string> = {
  OD: "Ojo derecho",
  OI: "Ojo izquierdo",
};

export const imageQualityStatusLabels: Record<ImageQualityStatus, string> = {
  PENDIENTE: "Pendiente",
  ADECUADA: "Adecuada",
  INADECUADA: "Inadecuada",
};

export const imageQualityReasonLabels: Record<ImageQualityReason, string> = {
  DESENFOQUE: "Desenfoque",
  REFLEJO: "Reflejo",
  MALA_ILUMINACION: "Mala iluminacion",
  CAMPO_INCOMPLETO: "Campo incompleto",
  MOVIMIENTO: "Movimiento",
  OTRO: "Otro",
};

export const repeatCaptureSuggestion = "Repetir captura";
export const betaAiUnavailableMessage = "Módulo de Inteligencia Artificial no disponible en esta versión beta.";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value ? value : null));

export const screeningFormSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(screeningStatusValues),
  generalObservations: optionalText(1200),
  assignedReviewerId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
});

export const retinalImageMetadataSchema = z.object({
  screeningId: z.string().uuid(),
  patientId: z.string().uuid(),
  laterality: z.enum(retinalImageLateralityValues),
  originalFileName: z.string().trim().min(1).max(240),
  storagePath: z.string().trim().min(8).max(900),
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  hashSha256: z.string().trim().length(64).nullable().optional(),
});

export const imageQualityReviewSchema = z
  .object({
    retinalImageId: z.string().uuid(),
    qualityStatus: z.enum(imageQualityStatusValues),
    reasons: z.array(z.enum(imageQualityReasonValues)).default([]),
    otherReason: optionalText(240),
  })
  .superRefine((value, context) => {
    if (value.qualityStatus === "INADECUADA" && value.reasons.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleccione al menos un motivo cuando la imagen es inadecuada.",
        path: ["reasons"],
      });
    }

    if (value.qualityStatus !== "INADECUADA" && value.reasons.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los motivos aplican solamente a imagenes inadecuadas.",
        path: ["reasons"],
      });
    }
  });

export type ScreeningFormInput = z.input<typeof screeningFormSchema>;
export type ScreeningFormData = z.output<typeof screeningFormSchema>;
export type RetinalImageMetadataInput = z.input<typeof retinalImageMetadataSchema>;
export type ImageQualityReviewInput = z.input<typeof imageQualityReviewSchema>;
export type ImageQualityReviewData = z.output<typeof imageQualityReviewSchema>;

export interface Screening extends Omit<ScreeningFormData, "patientId"> {
  id: string;
  organizationId: string;
  patientId: string;
  /** Immutable expediente code generated for this visit. */
  recordCode: string;
  createdBy: string | null;
  updatedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  patientPublishedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetinalImage {
  id: string;
  organizationId: string;
  patientId: string;
  screeningId: string;
  laterality: RetinalImageLaterality;
  capturedAt: string;
  uploadedBy: string | null;
  originalFileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string | null;
  status: RetinalImageStatus;
  replacedByImageId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string;
}

export interface ImageQualityReview extends ImageQualityReviewData {
  id: string;
  organizationId: string;
  patientId: string;
  screeningId: string;
  reviewerUserId: string | null;
  suggestion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientTimelineEvent {
  id: string;
  organizationId: string;
  patientId: string;
  eventType: string;
  title: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ScreeningDetail extends Screening {
  images: RetinalImage[];
  qualityReviews: ImageQualityReview[];
}

export function getChangedScreeningFields(previous: Screening, next: ScreeningFormData): string[] {
  const changed: string[] = [];
  if (previous.patientId !== next.patientId) changed.push("patientId");
  if (previous.status !== next.status) changed.push("status");
  if (previous.generalObservations !== next.generalObservations) changed.push("generalObservations");
  if (previous.assignedReviewerId !== next.assignedReviewerId) changed.push("assignedReviewerId");
  return changed;
}

export function getQualitySuggestion(status: ImageQualityStatus): string | null {
  return status === "INADECUADA" ? repeatCaptureSuggestion : null;
}
