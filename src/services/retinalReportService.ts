import type { TypedSupabaseClient } from "../lib/supabase";
import type { RetinalPrediction } from "../domain/retinalModel";
import type { RetinalImage } from "../domain/screening";
import { retinalApprovedReportSchema, retinalReportStateSchema, retinalRunSchema } from "../domain/retinalReport";

export function createRetinalReportService(client: TypedSupabaseClient) {
  return {
    load: async (screeningId: string) => {
      const { data, error } = await client.rpc("get_screening_retinal_analyses", { target_screening_id: screeningId });
      if (error) throw new Error("No se pudieron cargar los análisis guardados. Reintente y compruebe que la base esté actualizada.");
      return retinalReportStateSchema.parse(data);
    },
    save: async (runId: string, image: RetinalImage, prediction: RetinalPrediction) => {
      if (prediction.imageId !== image.id || prediction.screeningId !== image.screeningId || prediction.organizationId !== image.organizationId) {
        throw new Error("El resultado no corresponde a la imagen seleccionada.");
      }
      const { data, error } = await client.rpc("save_retinal_analysis", {
        target_run_id: runId, target_image_id: image.id, target_image_updated_at: image.updatedAt,
        target_scores: prediction.scores.map(item => item.score), target_elapsed_ms: Math.round(prediction.elapsedMs),
      });
      if (error) throw new Error("El análisis NO se guardó. Compruebe su conexión y que la visita siga abierta, sin publicar y con la misma imagen.");
      return retinalRunSchema.parse(data);
    },
    approve: async (screeningId: string) => {
      const { data, error } = await client.rpc("approve_retinal_analysis_report", { target_screening_id: screeningId });
      if (error) throw new Error("No se pudo aprobar el anexo. Revise la calidad de las imágenes y guarde la revisión profesional después de evaluar los análisis, antes de publicar o cerrar.");
      return retinalApprovedReportSchema.parse(data);
    },
  };
}
export type RetinalReportService = ReturnType<typeof createRetinalReportService>;
