import { describe, expect, it } from "vitest";
import { RETINAL_CLASSES, interpretRetinalScores, resizeRetinalRgb } from "./retinalModel";

describe("retinal model contract", () => {
  it("preserves supplied output index order, not severity order", () => {
    expect(RETINAL_CLASSES).toEqual(["alto_riesgo", "bajo_riesgo", "muy_alto_riesgo", "muy_bajo_riesgo", "riesgo_moderado"]);
    const prediction = interpretRetinalScores([0.05, 0.1, 0.7, 0.1, 0.05]);
    expect(prediction.predictedClass).toBe("muy_alto_riesgo");
    expect(prediction.predictedLabel).toBe("Muy alto riesgo");
    expect(prediction.scores.map(score => score.className)).toEqual(RETINAL_CLASSES);
  });
  it.each([[0, 0], [NaN, 0, 0, 0, 1], [Infinity, 0, 0, 0, 0], [-0.1, 0.1, 1, 0, 0], [0, 0, 0, 0, 0]])("rejects malformed output %j", (...scores) => {
    expect(() => interpretRetinalScores(scores)).toThrow("salida inválida");
  });
  it("keeps raw RGB values and discards alpha rather than normalizing twice", () => {
    const resized = resizeRetinalRgb([255, 128, 0, 255], 1, 1, 4);
    expect(resized.length).toBe(128 * 128 * 3);
    expect(Array.from(resized.slice(0, 6))).toEqual([255, 128, 0, 255, 128, 0]);
  });
  it("rejects invalid source dimensions", () => {
    expect(() => resizeRetinalRgb([], 0, 128)).toThrow();
    expect(() => resizeRetinalRgb([1, 2, 3], 2, 2)).toThrow();
  });
});
