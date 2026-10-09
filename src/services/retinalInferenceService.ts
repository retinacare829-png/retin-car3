import type { RetinalImage } from "../domain/screening";
import { RETINAL_MODEL_VERSION, type RetinalPrediction } from "../domain/retinalModel";
export { RetinalInferenceError } from "../domain/retinalInferenceError";

export interface RetinalInferenceRequest {
  image: RetinalImage;
  imageUrl: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

// The TensorFlow runtime/model is intentionally absent from the initial page bundle.
export async function analyzeRetinalImage({ image, imageUrl, signal, onProgress }: RetinalInferenceRequest): Promise<RetinalPrediction> {
  signal?.throwIfAborted();
  if (image.status !== "ACTIVA" || !image.id || !image.screeningId || !image.organizationId) {
    throw new Error("Seleccione una imagen activa del expediente.");
  }
  onProgress?.("Preparando el motor de IA…");
  const started = performance.now();
  const { predictRetinalImage } = await import("./retinalInferenceRuntime");
  signal?.throwIfAborted();
  const result = await predictRetinalImage(imageUrl, signal, onProgress);
  signal?.throwIfAborted();
  return { ...result, imageId: image.id, screeningId: image.screeningId, organizationId: image.organizationId,
    laterality: image.laterality, modelVersion: RETINAL_MODEL_VERSION, generatedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started) };
}
