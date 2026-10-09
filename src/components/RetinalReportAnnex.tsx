import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRetinalReportService } from "../services/retinalReportService";
import { type PatientRetinalAnnex, type RetinalReportState } from "../domain/retinalReport";
import { describeRetinalUncertainty, interpretRetinalScores } from "../domain/retinalModel";
import "./RetinalReportAnnex.css";

const service = supabase ? createRetinalReportService(supabase) : null;

export function RetinalScoresSummary({ scores }: { scores: number[] }) {
  const uncertainty = describeRetinalUncertainty(scores);
  return <div className="retinal-annex-scores">
    <strong>{uncertainty.title}</strong><p>{uncertainty.explanation}</p>
    <dl>{interpretRetinalScores(scores).scores.map(item => <div key={item.className}>
      <dt>{item.label}</dt><dd>{item.score.toLocaleString("es", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</dd>
    </div>)}</dl>
    <small>Puntuaciones del modelo (0–1), no probabilidades clínicas. Modelo experimental sin validación diagnóstica.</small>
  </div>;
}

export function PatientRetinalAnnexView({ annex }: { annex: PatientRetinalAnnex }) {
  return <details className="retinal-annex"><summary>Anexo experimental revisado por el profesional</summary>
    <p>No es un diagnóstico. Consultá las conclusiones y recomendaciones con tu profesional.</p>
    {annex.analyses.map(run => <section key={run.laterality} aria-label={`Análisis ${run.laterality}`}>
      <h3>{run.laterality === "OD" ? "Ojo derecho" : "Ojo izquierdo"}</h3>
      <RetinalScoresSummary scores={run.scores} /><small>{run.modelVersion} · {new Date(run.createdAt).toLocaleString("es-NI")}</small>
    </section>)}
    <small>Anexo aprobado el {new Date(annex.approvedAt).toLocaleString("es-NI")}. Solo contiene lo aprobado en ese momento.</small>
  </details>;
}

export function RetinalReportReview({ screeningId, canApprove, published }: { screeningId: string; canApprove: boolean; published: boolean }) {
  return <ReviewSession key={screeningId} screeningId={screeningId} canApprove={canApprove} published={published} />;
}

function ReviewSession({ screeningId, canApprove, published }: { screeningId: string; canApprove: boolean; published: boolean }) {
  const [state, setState] = useState<RetinalReportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!service) return;
    setError(null);
    void service.load(screeningId).then(result => { if (active) setState(result); })
      .catch(() => { if (active) setError("No se pudieron cargar los anexos. Reintente."); });
    return () => { active = false; };
  }, [screeningId, revision]);

  async function approve() {
    if (!service || !canApprove || busy || published || state?.approvedReport) return;
    if (!globalThis.confirm("¿Aprobar el anexo experimental? Confirma que revisó estas puntuaciones y las imágenes de calidad adecuada. La copia será inmutable y solo aparecerá al paciente cuando publique el informe.")) return;
    setBusy(true); setError(null);
    try { await service.approve(screeningId); setRevision(value => value + 1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo aprobar el anexo."); }
    finally { setBusy(false); }
  }
  const runs = state?.approvedReport?.analyses ?? state?.analyses ?? [];
  return <section className="workflow-card retinal-annex" aria-label="Anexo CNN del paciente">
    <p className="eyebrow">Expediente · apoyo experimental</p><h3>Análisis guardados de este paciente</h3>
    <p>Las puntuaciones provienen del navegador y no son un diagnóstico verificado. Revise las imágenes antes de incorporarlas al informe.</p>
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" className="ghost-button" onClick={() => setRevision(value => value + 1)} disabled={busy}>Actualizar anexos</button>
    {state && runs.length === 0 ? <p>Todavía no hay análisis guardados para esta visita.</p> : null}
    {runs.map(run => <details key={run.id}><summary>{run.laterality} · {new Date(run.created_at).toLocaleString("es-NI")} · {state?.approvedReport ? "Aprobado" : "Borrador"}</summary>
      <RetinalScoresSummary scores={run.scores} /><small>{run.model_version} · Imagen {run.retinal_image_id.slice(0, 8)} · {run.source === "browser_unverified" ? "Inferencia en navegador" : ""}</small>
    </details>)}
    {state?.approvedReport ? <p role="status">Anexo aprobado y conservado. {published ? "Disponible en el informe del paciente." : "Falta publicar el informe al paciente."}</p>
      : runs.length ? <><p>Apruebe el anexo antes de publicar. Se incluirá el último análisis vigente de cada ojo con calidad adecuada. Una nueva imagen o un análisis posterior requiere revisar nuevamente.</p>
        <button type="button" className="primary-button" disabled={!canApprove || published || busy} onClick={() => void approve()}>{busy ? "Aprobando…" : "Aprobar anexo experimental"}</button></> : null}
  </section>;
}
