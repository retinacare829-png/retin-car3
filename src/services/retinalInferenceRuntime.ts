import * as tf from "../lib/tensorflow";
import { RETINAL_CLASSES, RETINAL_INPUT_SIZE, interpretRetinalScores, resizeRetinalRgb } from "../domain/retinalModel";
import { RetinalInferenceError } from "../domain/retinalInferenceError";

let modelPromise: Promise<tf.LayersModel> | undefined;
const MODEL_URL = `${import.meta.env.BASE_URL}models/retincare-v1/model.json`;

async function getModel(): Promise<tf.LayersModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      // WebGL where available; CPU also works without a GPU or remote AI server.
      try { if (!await tf.setBackend("webgl")) await tf.setBackend("cpu"); }
      catch { await tf.setBackend("cpu"); }
      await tf.ready();
      const timeout = new AbortController();
      const timer = globalThis.setTimeout(() => timeout.abort(), 45_000);
      let model: tf.LayersModel | undefined;
      try {
        model = await tf.loadLayersModel(MODEL_URL, { requestInit: { signal: timeout.signal, credentials: "same-origin" } });
        const metadata = model.getUserDefinedMetadata() as { classes?: unknown } | undefined;
        if (JSON.stringify(metadata?.classes) !== JSON.stringify(RETINAL_CLASSES) || JSON.stringify(model.inputs[0]?.shape) !== JSON.stringify([null, 128, 128, 3]) || JSON.stringify(model.outputs[0]?.shape) !== JSON.stringify([null, 5])) {
          throw new Error("Model contract mismatch");
        }
        return model;
      } catch {
        model?.dispose();
        throw new RetinalInferenceError("No se pudo cargar el modelo de IA. Compruebe la conexión y vuelva a intentarlo.");
      } finally { globalThis.clearTimeout(timer); }
    })().catch(error => { modelPromise = undefined; throw error; });
  }
  return modelPromise;
}

async function decodeRgb(imageUrl: string, signal?: AbortSignal): Promise<Uint8Array> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.throwIfAborted();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = globalThis.setTimeout(cancel, 45_000);
  let blob: Blob;
  try {
    const response = await fetch(imageUrl, { signal: controller.signal, credentials: "omit", cache: "no-store" });
    if (!response.ok) throw new RetinalInferenceError("No se pudo descargar la imagen autorizada. Vuelva a abrir el expediente e intente nuevamente.");
    const length = Number(response.headers.get("content-length"));
    if (length > 15 * 1024 * 1024) throw new RetinalInferenceError("Use una imagen retinal de hasta 15 MB.");
    blob = await response.blob();
  } catch (error) {
    signal?.throwIfAborted();
    if (controller.signal.aborted) throw new RetinalInferenceError("La descarga de la imagen tardó demasiado. Compruebe la conexión y reintente.");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
  signal?.throwIfAborted();
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type) || blob.size > 15 * 1024 * 1024 || blob.size === 0) {
    throw new RetinalInferenceError("Use una imagen retinal JPG, PNG o WEBP de hasta 15 MB.");
  }
  // Retina captures should have no EXIF rotation; do not add crops or enhancement
  // that were absent from the supplied Keras load_img inference script.
  const bitmap = await createImageBitmap(blob, { imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "none" });
  try {
    signal?.throwIfAborted();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16_000_000) {
      throw new RetinalInferenceError("La imagen supera 16 megapíxeles. Cargue una captura de menor resolución para este prototipo.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new RetinalInferenceError("Este navegador no permite preparar la imagen para IA.");
    try {
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 255) throw new RetinalInferenceError("La captura tiene transparencia. Use una imagen retinal opaca para analizarla.");
      }
      return resizeRetinalRgb(pixels, bitmap.width, bitmap.height, 4);
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { bitmap.close(); }
}

export async function predictRetinalImage(imageUrl: string, signal?: AbortSignal, onProgress?: (message: string) => void) {
  onProgress?.("Cargando el modelo RetinaCare…");
  const model = await getModel();
  signal?.throwIfAborted();
  onProgress?.("Preparando la imagen del ojo seleccionado…");
  const pixels = await decodeRgb(imageUrl, signal);
  signal?.throwIfAborted();
  onProgress?.("Analizando la imagen en este dispositivo…");
  await tf.nextFrame();
  signal?.throwIfAborted();
  const output = tf.tidy(() => {
    // Original Keras model includes Rescaling(1/255); the converted topology does
    // not. This is the ONLY normalization, matched against the original model.
    const input = tf.mul(tf.tensor4d(pixels, [1, RETINAL_INPUT_SIZE, RETINAL_INPUT_SIZE, 3], "float32"), 1 / 255);
    const prediction = model.predict(input);
    if (Array.isArray(prediction)) throw new Error("Salida de modelo no compatible.");
    return prediction;
  });
  try {
    const scores = await output.data();
    signal?.throwIfAborted();
    return interpretRetinalScores(scores);
  } finally { output.dispose(); }
}
