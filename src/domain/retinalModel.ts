import type { RetinalImageLaterality } from "./screening";

export const RETINAL_MODEL_VERSION = "RetinCare CNN · 2026-10-08";
export const RETINAL_INPUT_SIZE = 128;
// This is the trained output-index order, NOT ascending clinical severity.
export const RETINAL_CLASSES = ["alto_riesgo", "bajo_riesgo", "muy_alto_riesgo", "muy_bajo_riesgo", "riesgo_moderado"] as const;
export const experimentalAiMessage = "CNN experimental disponible en Screenings. Sus resultados requieren revisión profesional.";
export type RetinalClass = (typeof RETINAL_CLASSES)[number];
export const retinalClassLabels: Record<RetinalClass, string> = {
  alto_riesgo: "Alto riesgo",
  bajo_riesgo: "Bajo riesgo",
  muy_alto_riesgo: "Muy alto riesgo",
  muy_bajo_riesgo: "Muy bajo riesgo",
  riesgo_moderado: "Riesgo moderado",
};

export interface RetinalPrediction {
  imageId: string;
  screeningId: string;
  organizationId: string;
  laterality: RetinalImageLaterality;
  modelVersion: string;
  generatedAt: string;
  scores: Array<{ className: RetinalClass; label: string; score: number }>;
  predictedClass: RetinalClass;
  predictedLabel: string;
  elapsedMs: number;
}

export function interpretRetinalScores(values: ArrayLike<number>) {
  if (values.length !== RETINAL_CLASSES.length || Array.from(values).some(value => !Number.isFinite(value) || value < 0 || value > 1) || Math.abs(Array.from(values).reduce((sum, value) => sum + value, 0) - 1) > 0.001) {
    throw new Error("El modelo devolvió una salida inválida. No se generó ningún resultado.");
  }
  const scores = RETINAL_CLASSES.map((className, index) => ({ className, label: retinalClassLabels[className], score: values[index]! }));
  const top = scores.reduce((best, current) => current.score > best.score ? current : best);
  return { scores, predictedClass: top.className, predictedLabel: top.label };
}

/** Presentation heuristic only, NOT a clinically validated confidence threshold. */
export function describeRetinalUncertainty(values: number[]) {
  const { scores } = interpretRetinalScores(values);
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const ambiguous = ranked[0]!.score < 0.5 || ranked[0]!.score - ranked[1]!.score < 0.15;
  return {
    ambiguous,
    title: ambiguous ? "Resultado no concluyente" : "Salida experimental del modelo",
    explanation: ambiguous
      ? "Las puntuaciones no separan claramente una categoría. No interprete la etiqueta mayor como riesgo del paciente."
      : "Una puntuación dominante tampoco demuestra enfermedad ni exactitud. Requiere evaluación profesional independiente.",
  };
}

/** PIL-compatible center-sampled nearest resize, RGB uint8; NO normalization. */
export function resizeRetinalRgb(source: ArrayLike<number>, width: number, height: number, channels: 3 | 4 = 3): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || source.length !== width * height * channels) {
    throw new Error("Las dimensiones de la imagen no son válidas.");
  }
  const output = new Uint8Array(RETINAL_INPUT_SIZE * RETINAL_INPUT_SIZE * 3);
  for (let y = 0; y < RETINAL_INPUT_SIZE; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / RETINAL_INPUT_SIZE));
    for (let x = 0; x < RETINAL_INPUT_SIZE; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / RETINAL_INPUT_SIZE));
      const from = (sy * width + sx) * channels;
      const to = (y * RETINAL_INPUT_SIZE + x) * 3;
      for (let channel = 0; channel < 3; channel++) output[to + channel] = source[from + channel]!;
    }
  }
  return output;
}
