import { z } from "zod";
import { professionalReviewStatusValues, structuredObservationsSchema } from "./clinicalWorkflow";
import { screeningStatusValues } from "./screening";

export const professionalReportTypeValues = ["SCREENING_SUMMARY", "PATIENT_SUMMARY", "OPERATIONAL_SUMMARY"] as const;
export const professionalReportScopeValues = ["NON_DIAGNOSTIC"] as const;

export type ProfessionalReportType = (typeof professionalReportTypeValues)[number];
export type ProfessionalReportScope = (typeof professionalReportScopeValues)[number];

export const professionalReportDisclaimer =
  "Reporte operativo no diagnostico. No determina la presencia o ausencia de enfermedad y no sustituye la valoracion de un profesional de salud.";

const uuid = z.string().uuid();
const optionalUuid = uuid.nullish().transform((value) => value || undefined);
const optionalDate = z.string().date().nullish().transform((value) => value || undefined);

export const reportFiltersSchema = z
  .object({
    organizationId: uuid,
    patientId: optionalUuid,
    screeningId: optionalUuid,
    status: z.enum(screeningStatusValues).optional(),
    createdFrom: optionalDate,
    createdTo: optionalDate,
    includeClosed: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "El rango de fechas no es valido." });
    }
  });

export type ReportFiltersInput = z.input<typeof reportFiltersSchema>;
export type ReportFilters = z.output<typeof reportFiltersSchema>;

export const reportGenerationContextSchema = z.object({
  organizationId: uuid,
  patientId: uuid,
  screeningId: uuid,
  actorUserId: uuid,
  actorRole: z.enum(["clinic_admin", "technical_staff", "authorized_professional"]),
});

export type ReportGenerationContext = z.infer<typeof reportGenerationContextSchema>;

export const reportableScreeningStatuses = ["REVISADO", "SEGUIMIENTO_REQUERIDO", "CERRADO"] as const;
export type ReportableScreeningStatus = (typeof reportableScreeningStatuses)[number];

const reportPatientSchema = z.object({
  id: uuid,
  internalIdentifier: z.string(),
  medicalRecordCode: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().date(),
  sex: z.enum(["female", "male", "other", "unknown"]),
  diabetesType: z.enum(["type_1", "type_2", "gestational", "other", "unknown"]),
});

const reportImageSchema = z.object({
  id: uuid,
  laterality: z.enum(["OD", "OI"]),
  capturedAt: z.string().datetime(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(["ACTIVA", "REEMPLAZADA", "ELIMINADA"]),
  qualityStatus: z.enum(["PENDIENTE", "ADECUADA", "INADECUADA"]).nullable(),
  qualityReasons: z.array(z.enum(["DESENFOQUE", "REFLEJO", "MALA_ILUMINACION", "CAMPO_INCOMPLETO", "MOVIMIENTO", "OTRO"])),
});

const reportReviewSchema = z.object({
  status: z.enum(professionalReviewStatusValues),
  reviewedAt: z.string().datetime().nullable(),
  structuredObservations: structuredObservationsSchema,
  notes: z.string().nullable(),
}).nullable();

const reportFollowUpSchema = z.object({
  type: z.enum(["CONTROL_PROGRAMADO", "REPETIR_ESTUDIO", "REFERIR_OFTALMOLOGIA"]),
  status: z.enum(["SIN_SEGUIMIENTO", "CONTROL_PROGRAMADO", "REPETIR_ESTUDIO", "REFERIR_OFTALMOLOGIA", "SEGUIMIENTO_COMPLETADO", "CANCELADO"]),
  dueDate: z.string().date().nullable(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
});

const reportReferralSchema = z.object({
  reason: z.string(),
  destination: z.string(),
  status: z.enum(["BORRADOR", "SOLICITADA", "EN_PROCESO", "COMPLETADA", "CANCELADA"]),
  requestedDate: z.string().date(),
  completedDate: z.string().date().nullable(),
  notes: z.string().nullable(),
});

export const professionalReportSchema = z.object({
  schemaVersion: z.literal(1),
  reportType: z.literal("SCREENING_SUMMARY"),
  scope: z.enum(professionalReportScopeValues),
  disclaimer: z.string().min(20),
  organizationId: uuid,
  generatedBy: uuid,
  generatedAt: z.string().datetime(),
  patient: reportPatientSchema,
  screening: z.object({
    id: uuid,
    status: z.enum(screeningStatusValues),
    generalObservations: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
  }),
  images: z.array(reportImageSchema),
  professionalReview: reportReviewSchema,
  followUps: z.array(reportFollowUpSchema),
  referrals: z.array(reportReferralSchema),
}).strict();

export type ProfessionalReport = z.infer<typeof professionalReportSchema>;

export const patientReportSchema = z.object({
  schemaVersion: z.literal(1),
  reportType: z.literal("PATIENT_SUMMARY"),
  scope: z.literal("NON_DIAGNOSTIC"),
  disclaimer: z.string().min(20),
  organizationId: uuid,
  generatedBy: uuid,
  generatedAt: z.string().datetime(),
  patient: reportPatientSchema,
  screenings: z.array(z.object({
    id: uuid,
    status: z.enum(screeningStatusValues),
    createdAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
    professionalReviewStatus: z.enum(professionalReviewStatusValues).nullable(),
    activeImages: z.object({ OD: z.number().int().nonnegative(), OI: z.number().int().nonnegative() }),
    followUps: z.number().int().nonnegative(),
    referrals: z.number().int().nonnegative(),
  })),
}).strict();

export type PatientReport = z.infer<typeof patientReportSchema>;

export const operationalReportFiltersSchema = z.object({
  organizationId: uuid,
  from: z.string().date(),
  to: z.string().date(),
}).superRefine((value, context) => {
  if (value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "El rango de fechas no es valido." });
});

export type OperationalReportFilters = z.infer<typeof operationalReportFiltersSchema>;

export const operationalReportSchema = z.object({
  schemaVersion: z.literal(1),
  reportType: z.literal("OPERATIONAL_SUMMARY"),
  scope: z.literal("NON_DIAGNOSTIC"),
  disclaimer: z.string().min(20),
  organizationId: uuid,
  generatedBy: uuid,
  generatedAt: z.string().datetime(),
  range: z.object({ from: z.string().date(), to: z.string().date() }),
  totals: z.object({
    newPatients: z.number().int().nonnegative(),
    screenings: z.number().int().nonnegative(),
    completedScreenings: z.number().int().nonnegative(),
    pendingReviews: z.number().int().nonnegative(),
    activeFollowUps: z.number().int().nonnegative(),
    activeReferrals: z.number().int().nonnegative(),
  }),
  screeningsByStatus: z.array(z.object({ status: z.enum(screeningStatusValues), total: z.number().int().nonnegative() })),
}).strict();

export type OperationalReport = z.infer<typeof operationalReportSchema>;

export interface ReportCandidate {
  organizationId: string;
  patientId: string;
  screeningId: string;
  patientName: string;
  internalIdentifier: string;
  screeningStatus: typeof screeningStatusValues[number];
  createdAt: string;
  closedAt: string | null;
}
