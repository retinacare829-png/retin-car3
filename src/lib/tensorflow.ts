// Only inference components; omit TFJS data/converter/CLI dependencies.
export * from "@tensorflow/tfjs-core";
export { loadLayersModel, type LayersModel } from "@tensorflow/tfjs-layers";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
