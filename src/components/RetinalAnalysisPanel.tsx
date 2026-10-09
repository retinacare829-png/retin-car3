import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ImageQualityStatus, RetinalImage } from "../domain/screening";
import { describeRetinalUncertainty, RETINAL_MODEL_VERSION, type RetinalPrediction } from "../domain/retinalModel";
import { runToPrediction } from "../domain/retinalReport";
import type { RetinalReportService } from "../services/retinalReportService";
import { analyzeRetinalImage, RetinalInferenceError } from "../services/retinalInferenceService";
import "./RetinalAnalysisPanel.css";
import { MatrixThinkingOrb } from "./MatrixThinkingOrb";

interface RetinalAnalysisPanelProps {
  image: RetinalImage | null;
  qualityStatus: ImageQualityStatus;
  getImageUrl: (image: RetinalImage) => Promise<string>;
  reportService?: RetinalReportService;
  readOnly?: boolean;
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

function AnalysisSession({ image, qualityStatus, getImageUrl, reportService, readOnly = false }: RetinalAnalysisPanelProps) {
  const id = useId();
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<RetinalPrediction | null>(null);
  const [saved, setSaved] = useState(false);
  const [approved, setApproved] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(image && reportService));
  const saveId = useRef<string | null>(null);
  const inactive = image !== null && (image.status !== "ACTIVA" || image.deletedAt !== null);
  const blocked = !image || inactive || qualityStatus === "INADECUADA" || readOnly || approved || loadingHistory;
  const uncertainty = prediction ? describeRetinalUncertainty(prediction.scores.map(score => score.score)) : null;

  useEffect(() => {
    if (!image || !reportService) return;
    let current = true;
    void reportService.load(image.screeningId).then(history => {
      if (!current) return;
      setApproved(Boolean(history.approvedReport));
      const latest = history.analyses.find(run => run.retinal_image_id === image.id
        && Date.parse(run.image_updated_at) === Date.parse(image.updatedAt));
      if (latest) { setPrediction(runToPrediction(latest)); setSaved(true); }
    }).catch(() => {
      if (current) setError("No se pudieron cargar los análisis guardados. Recargue la página para reintentar.");
    }).finally(() => { if (current) setLoadingHistory(false); });
    return () => { current = false; };
  }, [image, reportService]);

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
    setSaved(false);
    saveId.current = globalThis.crypto.randomUUID();
    setProgress("Preparando la imagen seleccionada…");
    let stage: "image" | "inference" | "save" = "image";

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
      if (reportService) {
        stage = "save";
        setProgress("Guardando anexo experimental en el expediente…");
        await reportService.save(saveId.current, image, result);
        if (!isCurrent()) return;
        setSaved(true);
      }
      setProgress(reportService ? "Análisis guardado como borrador privado. Pendiente de aprobación profesional."
        : "Análisis experimental completado. Requiere revisión profesional.");
    } catch (caught) {
      if (!isCurrent()) return;
      setProgress("");
      setError(stage === "save" ? "El análisis NO se guardó. Reintente el guardado; compruebe su conexión y que la visita siga abierta con la misma imagen."
        : caught instanceof RetinalInferenceError ? caught.message : stage === "image"
        ? "No se pudo acceder a la imagen. Verifique su conexión y acceso al expediente, y vuelva a intentar."
        : "No se pudo completar el análisis. Verifique su conexión y vuelva a intentar. Si continúa, recargue la página o contacte a soporte.");
    } finally {
      if (isCurrent()) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  async function retrySave() {
    if (!reportService || !image || !prediction || !saveId.current || blocked || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    try {
      await reportService.save(saveId.current, image, prediction);
      if (controller.signal.aborted) return;
      setSaved(true); setProgress("Análisis guardado como borrador privado. Pendiente de aprobación profesional.");
    } catch {
      if (!controller.signal.aborted) setError("El análisis NO se guardó. Compruebe la conexión, la imagen y el estado de la visita.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
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
          <MatrixThinkingOrb active={busy} announce={false} size={88} />
          <p className="retinal-analysis-disclaimer" id={`${id}-disclaimer`}>
            El modelo puede equivocarse y requiere revisión profesional. No genera un diagnóstico automático.
            {reportService ? " Las puntuaciones se guardan como anexo experimental privado del paciente. Solo llegan a su portal si el profesional aprueba el anexo y publica el informe."
              : " El resultado es temporal: no se guarda en el expediente, no constituye un informe clínico ni se publica al paciente."}
          </p>
          {readOnly || approved ? <p className="field-help">Informe cerrado, publicado o con anexo aprobado. Sus resultados guardados se conservan sin modificaciones.</p> : null}
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
              disabled={blocked || busy || Boolean(reportService && prediction && !saved)}
              aria-describedby={`${id}-context ${id}-disclaimer`}
              onClick={() => void analyze()}
            >
              {busy ? `Analizando ${image?.laterality ?? "imagen"}…`
                : error ? `Reintentar análisis ${image?.laterality ?? ""}`
                  : `Analizar ${image?.laterality ?? "imagen seleccionada"}`}
            </button>
            {reportService && prediction && !saved ? <button type="button" className="secondary-button" disabled={blocked || busy} onClick={() => void retrySave()}>Reintentar guardado</button> : null}
            <small>Modelo {RETINAL_MODEL_VERSION}. Se carga al iniciar el análisis.</small>
          </div>
          <p className="retinal-analysis-progress" role="status" aria-live="polite" aria-atomic="true">{progress}</p>
          {error ? <p className="retinal-analysis-error" role="alert">{error}</p> : null}
        </div>
        {prediction ? (
          <div className="retinal-analysis-result" aria-labelledby={`${id}-result`}>
            <p className="retinal-analysis-result-label" id={`${id}-result`}>Anexo experimental · {saved ? "Guardado" : "Sin guardar"}</p>
            <strong className="retinal-analysis-category">{uncertainty?.title}</strong>
            <p className="retinal-analysis-score-help">
              {uncertainty?.explanation} El indicador de separación es orientativo; no es un umbral clínico validado.
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
              {prediction.laterality} · Modelo {prediction.modelVersion} · {(prediction.elapsedMs / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} s · {saved ? "Guardado en el expediente" : "Resultado sin guardar"}
            </small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
