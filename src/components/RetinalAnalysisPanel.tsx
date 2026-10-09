import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ImageQualityStatus, RetinalImage } from "../domain/screening";
import { RETINAL_MODEL_VERSION, type RetinalPrediction } from "../domain/retinalModel";
import { analyzeRetinalImage, RetinalInferenceError } from "../services/retinalInferenceService";
import "./RetinalAnalysisPanel.css";

interface RetinalAnalysisPanelProps {
  image: RetinalImage | null;
  qualityStatus: ImageQualityStatus;
  getImageUrl: (image: RetinalImage) => Promise<string>;
}

export function RetinalAnalysisPanel(props: RetinalAnalysisPanelProps) {
  const { image, qualityStatus } = props;
  // A new image revision owns a fresh UI and request lifecycle, even if its ID is reused.
  const identity = JSON.stringify([
    image?.id, image?.screeningId, image?.organizationId, image?.storagePath,
    image?.updatedAt, image?.laterality, image?.patientId, image?.status, image?.deletedAt, qualityStatus,
  ]);
  return <AnalysisSession key={identity} {...props} />;
}

function AnalysisSession({ image, qualityStatus, getImageUrl }: RetinalAnalysisPanelProps) {
  const id = useId();
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<RetinalPrediction | null>(null);
  const inactive = image !== null && (image.status !== "ACTIVA" || image.deletedAt !== null);
  const blocked = !image || inactive || qualityStatus === "INADECUADA";

  useLayoutEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  async function analyze() {
    // The ref locks synchronously, before React can render the disabled button.
    if (blocked || !image || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => request.current === controller && !controller.signal.aborted;
    setBusy(true);
    setError(null);
    setPrediction(null);
    setProgress("Preparando la imagen seleccionada…");
    let stage: "image" | "inference" = "image";

    try {
      const imageUrl = await getImageUrl(image);
      if (!isCurrent()) return;
      stage = "inference";
      setProgress("Cargando el modelo y analizando la imagen…");
      const result = await analyzeRetinalImage({
        image,
        imageUrl,
        signal: controller.signal,
        onProgress: (message: string) => {
          if (isCurrent()) setProgress(message);
        },
      });
      if (!isCurrent()) return;
      if (result.imageId !== image.id || result.screeningId !== image.screeningId
        || result.organizationId !== image.organizationId || result.laterality !== image.laterality) {
        throw new Error("Prediction does not match the selected image");
      }
      setPrediction(result);
      setProgress("Análisis experimental completado. Requiere revisión profesional.");
    } catch (caught) {
      if (!isCurrent()) return;
      setProgress("");
      setError(caught instanceof RetinalInferenceError ? caught.message : stage === "image"
        ? "No se pudo acceder a la imagen. Verifique su conexión y acceso al expediente, y vuelva a intentar."
        : "No se pudo completar el análisis. Verifique su conexión y vuelva a intentar. Si continúa, recargue la página o contacte a soporte.");
    } finally {
      if (isCurrent()) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section className="retinal-analysis-panel" aria-labelledby={`${id}-title`}>
      <div className="retinal-analysis-heading">
        <div>
          <p className="eyebrow">Apoyo a la revisión</p>
          <h3 id={`${id}-title`}>Análisis de imagen con CNN</h3>
        </div>
        <span className="beta-label">Experimental</span>
      </div>
      <div className={`retinal-analysis-body${prediction ? " retinal-analysis-body--with-result" : ""}`}>
        <div className="retinal-analysis-intro">
          <p className="retinal-analysis-disclaimer" id={`${id}-disclaimer`}>
            El modelo puede equivocarse y requiere revisión profesional. No genera un diagnóstico automático.
            El resultado es temporal: no se guarda en el expediente, no constituye un informe clínico ni se publica al paciente.
          </p>
          <p className="retinal-analysis-context" id={`${id}-context`}>
            {!image
              ? "Seleccione o cargue una imagen de OD u OI para iniciar el análisis."
              : inactive
                ? "Esta imagen ya no está activa. Seleccione o cargue una imagen activa para analizar."
              : qualityStatus === "INADECUADA"
                ? `La imagen de ${image.laterality} tiene calidad inadecuada. Repita la captura y revise su calidad antes de analizar.`
                : qualityStatus === "PENDIENTE"
                  ? `Imagen seleccionada: ${image.laterality}. La revisión de calidad está pendiente; una captura deficiente puede afectar el resultado.`
                  : `Imagen seleccionada: ${image.laterality}. Calidad adecuada.`}
          </p>
          <div className="retinal-analysis-actions">
            <button
              type="button"
              className="primary-button"
              disabled={blocked || busy}
              aria-describedby={`${id}-context ${id}-disclaimer`}
              onClick={() => void analyze()}
            >
              {busy ? `Analizando ${image?.laterality ?? "imagen"}…`
                : error ? `Reintentar análisis ${image?.laterality ?? ""}`
                  : `Analizar ${image?.laterality ?? "imagen seleccionada"}`}
            </button>
            <small>Modelo {RETINAL_MODEL_VERSION}. Se carga al iniciar el análisis.</small>
          </div>
          <p className="retinal-analysis-progress" role="status" aria-live="polite" aria-atomic="true">{progress}</p>
          {error ? <p className="retinal-analysis-error" role="alert">{error}</p> : null}
        </div>
        {prediction ? (
          <div className="retinal-analysis-result" aria-labelledby={`${id}-result`}>
            <p className="retinal-analysis-result-label" id={`${id}-result`}>Categoría sugerida por el modelo</p>
            <strong className="retinal-analysis-category">{prediction.predictedLabel}</strong>
            <p className="retinal-analysis-score-help">
              La etiqueta corresponde a la puntuación mayor, incluso cuando las puntuaciones son parecidas.
            </p>
            <p className="retinal-analysis-score-help" id={`${id}-scores`}>
              Puntuaciones relativas del modelo (0–1). No representan probabilidad clínica ni exactitud diagnóstica.
            </p>
            <ul className="retinal-analysis-scores" aria-label="Puntuaciones por categoría" aria-describedby={`${id}-scores`}>
              {prediction.scores.map(({ className, label, score }) => (
                <li key={className}>
                  <div className="retinal-analysis-score-heading">
                    <span>{label}</span>
                    <span className="retinal-analysis-score-value">{score.toLocaleString("es", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                  </div>
                  <meter min={0} max={1} value={score} aria-label={`Puntuación relativa: ${label}`} />
                </li>
              ))}
            </ul>
            <small className="retinal-analysis-metadata">
              {prediction.laterality} · Modelo {prediction.modelVersion} · {(prediction.elapsedMs / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} s · Resultado temporal
            </small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
