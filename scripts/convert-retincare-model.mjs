// Convert only the reviewed Keras standard layers. Input normalization moves to
// the runtime once (Keras Rescaling is not a TFJS Layers serialization primitive).
import * as tf from '@tensorflow/tfjs-core';
import { sequential, layers } from '@tensorflow/tfjs-layers';
import '@tensorflow/tfjs-backend-cpu';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [inputDir, outputDir] = process.argv.slice(2);
if (!inputDir || !outputDir) throw new Error('Usage: node scripts/convert-retincare-model.mjs <export-dir> <public-model-dir>');
await tf.setBackend('cpu');
const spec = JSON.parse(await readFile(path.join(inputDir, 'export.json'), 'utf8'));
const model = sequential();
for (const [index, layer] of spec.layers.entries()) {
  const c = layer.config;
  const common = { name: c.name, ...(index === 0 ? { inputShape: [128, 128, 3] } : {}) };
  switch (layer.class_name) {
    case 'Conv2D': model.add(layers.conv2d({ ...common, filters: c.filters, kernelSize: c.kernel_size, strides: c.strides, padding: c.padding, dataFormat: 'channelsLast', dilationRate: c.dilation_rate, activation: c.activation, useBias: c.use_bias })); break;
    case 'MaxPooling2D': model.add(layers.maxPooling2d({ ...common, poolSize: c.pool_size, strides: c.strides, padding: c.padding, dataFormat: 'channelsLast' })); break;
    case 'GlobalAveragePooling2D': model.add(layers.globalAveragePooling2d({ ...common, dataFormat: 'channelsLast', keepDims: c.keepdims })); break;
    case 'Dense': model.add(layers.dense({ ...common, units: c.units, activation: c.activation, useBias: c.use_bias })); break;
    default: throw new Error(`Unsupported layer: ${layer.class_name}`);
  }
}
const bytes = await readFile(path.join(inputDir, 'weights.bin'));
const floats = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
let offset = 0;
const tensors = spec.shapes.map(shape => {
  const length = shape.reduce((a, b) => a * b, 1);
  const tensor = tf.tensor(floats.slice(offset, offset + length), shape, 'float32');
  offset += length;
  return tensor;
});
if (offset !== floats.length) throw new Error('Unexpected extra weights');
model.setWeights(tensors);
tensors.forEach(t => t.dispose());
await mkdir(outputDir, { recursive: true });
await model.save(tf.io.withSaveHandler(async artifacts => {
  const weights = Buffer.from(artifacts.weightData);
  const json = {
    format: 'layers-model', generatedBy: `RetinaCare reviewed Keras ${spec.sourceKerasVersion} export`, convertedBy: 'TensorFlow.js 4.22.0',
    modelTopology: artifacts.modelTopology,
    weightsManifest: [{ paths: ['weights.bin'], weights: artifacts.weightSpecs }],
    userDefinedMetadata: { sourceSha256: spec.sourceSha256, classes: spec.classes, inputNormalization: 'RGB nearest 128x128; divide by 255 exactly once before predict', weightsSha256: createHash('sha256').update(weights).digest('hex') },
  };
  await writeFile(path.join(outputDir, 'weights.bin'), weights);
  await writeFile(path.join(outputDir, 'model.json'), JSON.stringify(json, null, 2));
  await writeFile(path.join(outputDir, 'classes.json'), JSON.stringify(spec.classes, null, 2));
  return { modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifacts) };
}));
model.dispose();
console.log(`Converted ${spec.parameterCount} parameters to ${outputDir}; source ${spec.sourceSha256}`);
