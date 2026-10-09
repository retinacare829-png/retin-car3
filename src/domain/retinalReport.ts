import { z } from "zod";
import { interpretRetinalScores } from "./retinalModel";

export const retinalScoresSchema = z.array(z.number().finite().min(0).max(1)).length(5)
  .refine(values => Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= 0.001);
export const retinalRunSchema = z.object({
  id: z.string().uuid(), organization_id: z.string().uuid(), patient_id: z.string().uuid(),
  screening_id: z.string().uuid(), retinal_image_id: z.string().uuid(), image_updated_at: z.string(),
  image_sha256: z.string().nullable(), laterality: z.enum(["OD", "OI"]), model_version: z.string(),
  model_sha256: z.string(), source: z.literal("browser_unverified"), scores: retinalScoresSchema,
  created_at: z.string(), created_by: z.string().uuid(), elapsed_ms: z.number().int(),
});
export const retinalApprovedReportSchema = z.object({
  screening_id: z.string().uuid(), organization_id: z.string().uuid(), patient_id: z.string().uuid(),
  approved_at: z.string(), approved_by: z.string().uuid(), analyses: z.array(retinalRunSchema),
});
export const retinalReportStateSchema = z.object({
  analyses: z.array(retinalRunSchema), approvedReport: retinalApprovedReportSchema.nullable(),
});
export const patientRetinalAnnexSchema = z.object({
  screeningId: z.string().uuid(), approvedAt: z.string(), analyses: z.array(z.object({
    laterality: z.enum(["OD", "OI"]), modelVersion: z.string(), scores: retinalScoresSchema, createdAt: z.string(),
  })),
});
export type RetinalRun = z.infer<typeof retinalRunSchema>;
export type RetinalReportState = z.infer<typeof retinalReportStateSchema>;
export type PatientRetinalAnnex = z.infer<typeof patientRetinalAnnexSchema>;
export function runToPrediction(run: RetinalRun) {
  return { ...interpretRetinalScores(run.scores), imageId: run.retinal_image_id, screeningId: run.screening_id,
    organizationId: run.organization_id, laterality: run.laterality, modelVersion: run.model_version,
    generatedAt: run.created_at, elapsedMs: run.elapsed_ms };
}
