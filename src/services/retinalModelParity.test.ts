// @vitest-environment node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as tf from "../lib/tensorflow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fixtures from "../test/fixtures/retinal-model-parity.json";
import { RETINAL_CLASSES, interpretRetinalScores, resizeRetinalRgb } from "../domain/retinalModel";

describe("real converted weights versus supplied Keras model", () => {
  let model: tf.LayersModel;
  beforeAll(async () => {
    await tf.setBackend("cpu");
    const json = JSON.parse(await readFile("public/models/retincare-v1/model.json", "utf8")) as {
      modelTopology: tf.io.ModelJSON["modelTopology"];
      weightsManifest: Array<{ weights: tf.io.WeightsManifestEntry[] }>;
      userDefinedMetadata: { classes: string[]; sourceSha256: string; weightsSha256: string };
    };
    const weights = await readFile("public/models/retincare-v1/weights.bin");
    expect(json.userDefinedMetadata.classes).toEqual(RETINAL_CLASSES);
    expect(json.userDefinedMetadata.sourceSha256).toBe(fixtures.sourceSha256);
    const original = await readFile("models/retincare/retincare.keras");
    expect(createHash("sha256").update(original).digest("hex")).toBe(fixtures.sourceSha256);
    expect(createHash("sha256").update(weights).digest("hex")).toBe(json.userDefinedMetadata.weightsSha256);
    model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: json.modelTopology,
      weightSpecs: json.weightsManifest[0]!.weights,
      weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength) }));
  });
  afterAll(() => model?.dispose());

  for (const fixture of fixtures.fixtures) {
    it(`matches original model and PIL nearest preprocessing: ${fixture.name}`, async () => {
      const rgb = Uint8Array.from({ length: fixture.width * fixture.height * 3 }, (_, index) => fixture.constant ?? (index * 37 + fixture.seed) % 256);
      const pixels = resizeRetinalRgb(rgb, fixture.width, fixture.height);
      expect(createHash("sha256").update(pixels).digest("hex")).toBe(fixture.resizedSha256);
      const tensorsBefore = tf.memory().numTensors;
      const result = tf.tidy(() => model.predict(tf.mul(tf.tensor4d(pixels, [1, 128, 128, 3], "float32"), 1 / 255)) as tf.Tensor);
      try {
        const actual = Array.from(await result.data());
        expect(interpretRetinalScores(actual).predictedClass).toBe(interpretRetinalScores(fixture.expectedScores).predictedClass);
        const maxError = Math.max(...actual.map((value, index) => Math.abs(value - fixture.expectedScores[index]!)));
        expect(maxError).toBeLessThan(0.0001);
      } finally { result.dispose(); }
      expect(tf.memory().numTensors).toBe(tensorsBefore);
    });
  }
});
