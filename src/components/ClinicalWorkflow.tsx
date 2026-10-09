import { Check, ClipboardCheck, ExternalLink, Save, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  buildClosureChecklist,
  followUpSchema,
  followUpStatusLabels,
  followUpStatusValues,
  followUpTypeLabels,
  followUpTypeValues,
  professionalReviewSchema,
  professionalReviewStatusLabels,
  professionalReviewStatusValues,
  referralSchema,
  referralStatusLabels,
  referralStatusValues,
  type FollowUp,
  type FollowUpInput,
  type ProfessionalReviewInput,
  type Referral,
  type ReferralInput,
  type StructuredObservations,
} from "../domain/clinicalWorkflow";
import type { Patient } from "../domain/patient";
import type { Role } from "../domain/roles";
import { retinalImageLateralityLabels, type ScreeningDetail } from "../domain/screening";
import { useClinicalWorkflow } from "../hooks/useClinicalWorkflow";
import { supabase } from "../lib/supabase";
import { friendlyError, notify } from "../lib/appEvents";
import { getStatusTone } from "../domain/statusTone";
import { EmptyState, LoadingState, StatusBadge } from "./ui";
import { RetinalReportReview } from "./RetinalReportAnnex";

interface ClinicalWorkflowProps {
  organizationId: string;
  patient: Patient;
  screening: ScreeningDetail;
  role: Role;
  user: User;
  onScreeningChanged: () => Promise<void>;
}

const emptyObservations: StructuredObservations = {
  insufficientQuality: false, repeatedImageRecommended: false, newCaptureRequired: false,
  reviewCompleted: false, followUpRecommended: false, referralRecommended: false,
};

export function ClinicalWorkflow({ organizationId, patient, screening, role, user, onScreeningChanged }: ClinicalWorkflowProps) {
  const workflow = useClinicalWorkflow(organizationId, patient.id, screening.id, role, user);
  const checklist = useMemo(() => buildClosureChecklist(screening, workflow.detail), [screening, workflow.detail]);
  const closed = screening.status === "CERRADO";
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const reviewApproved = ["REVISION_COMPLETADA", "SEGUIMIENTO_REQUERIDO"].includes(workflow.detail.professionalReview?.reviewStatus ?? "");
  const canPublish = workflow.canReview && reviewApproved && ["REVISADO", "SEGUIMIENTO_REQUERIDO"].includes(screening.status);
  const reportSummary = screening.generalObservations?.trim() || "Tu clínica compartió este informe. Consulta al profesional para conocer sus conclusiones.";

  async function publishForPatient() {
    if (!canPublish || screening.patientPublishedAt || !supabase) return;
    if (!globalThis.confirm(`¿Compartir este informe con el paciente? Se mostrará este resumen y quedará registrado: ${reportSummary}`)) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const { error } = await supabase.rpc("publish_screening_to_patient", { target_screening_id: screening.id });
      if (error) throw error;
      await onScreeningChanged();
      notify("Informe compartido con el paciente.");
    } catch (caught) {
      const message = friendlyError(caught, "No se pudo compartir el informe con el paciente.");
      setPublishError(message);
      notify(message, "error");
    } finally {
      setPublishing(false);
    }
  }

  async function closeScreening() {
    if (!checklist.canClose || closed) return;
    if (!globalThis.confirm("¿Cerrar este screening? Después del cierre no podrá modificar su workflow clínico.")) return;
    await workflow.closeScreening();
    await onScreeningChanged();
  }

  return (
    <section className="clinical-workflow" aria-labelledby="clinical-workflow-title">
      <div className="module-heading compact">
        <div>
          <p className="eyebrow">Paciente / Screening / Revisión</p>
          <h2 id="clinical-workflow-title">Workflow clínico</h2>
          <p>{patient.lastNames}, {patient.firstNames} · Expediente {screening.recordCode}</p>
        </div>
        <StatusBadge label={professionalReviewStatusLabels[workflow.detail.professionalReview?.reviewStatus ?? "PENDIENTE_REVISION"]} tone={getStatusTone(workflow.detail.professionalReview?.reviewStatus ?? "PENDIENTE_REVISION")} />
      </div>

      <div className="workflow-summary">
        <div><span>Screening</span><strong>{new Date(screening.createdAt).toLocaleDateString()}</strong></div>
        {(["OD", "OI"] as const).map((laterality) => {
          const image = screening.images.find((item) => item.laterality === laterality && item.status === "ACTIVA");
          const quality = image ? screening.qualityReviews.find((item) => item.retinalImageId === image.id) : null;
          return <div key={laterality}><span>{retinalImageLateralityLabels[laterality]}</span><strong>{image ? `Cargada · ${quality?.qualityStatus ?? "Calidad pendiente"}` : "Pendiente"}</strong></div>;
        })}
      </div>

      <p className="field-help">La CNN experimental se consulta junto a las imágenes del screening. Sus sugerencias no completan esta revisión ni publican reportes al paciente.</p>
      <aside className="workflow-guide" role="note"><strong>¿Qué sigue en este flujo?</strong><span>Primero confirme las imágenes OD/OI y su calidad. Luego complete la revisión profesional; solo después podrá compartir un resumen con el paciente o cerrar el screening.</span></aside>
      {workflow.error ? <div className="form-error" role="alert">{workflow.error}</div> : null}
      {workflow.loading ? <LoadingState label="Cargando workflow clínico" /> : null}
      {!workflow.loading && !workflow.detail.professionalReview ? <EmptyState title="Sin revisión profesional" description="Complete la revisión manual cuando un profesional autorizado haya evaluado el screening." /> : null}

      <div className="workflow-grid">
        <RetinalReportReview screeningId={screening.id} canApprove={canPublish && !closed} published={Boolean(screening.patientPublishedAt)} />
        <ProfessionalReviewForm disabled={workflow.saving || !workflow.canReview || closed} review={workflow.detail.professionalReview} onSave={workflow.saveReview} />
        <FollowUpPanel disabled={workflow.saving || !workflow.canWriteFollowUps || closed} followUps={workflow.detail.followUps} onSave={workflow.saveFollowUp} />
        <ReferralPanel disabled={workflow.saving || !workflow.canWriteReferrals || closed} referrals={workflow.detail.referrals} onSave={workflow.saveReferral} />
        <section className="workflow-card publication-card" aria-labelledby="patient-publication-title">
          <p className="eyebrow">Compartir resultados</p>
          <div className="panel-title"><ExternalLink aria-hidden="true" size={20} /><h3 id="patient-publication-title">Portal del paciente</h3></div>
          <p>El informe permanece privado hasta que un profesional complete la revisión y se confirme su publicación.</p>
          <div className="patient-report-preview"><strong>Resumen que verá el paciente:</strong><p>{reportSummary}</p></div>
          {screening.patientPublishedAt ? <p className="form-message">Compartido el {new Date(screening.patientPublishedAt).toLocaleDateString()}.</p> : null}
          {publishError ? <div className="form-error" role="alert">{publishError}</div> : null}
          <button className="primary-button" disabled={publishing || workflow.loading || !canPublish || Boolean(screening.patientPublishedAt)} onClick={() => void publishForPatient()} type="button">
            <ExternalLink aria-hidden="true" size={18} />{screening.patientPublishedAt ? "Informe compartido" : publishing ? "Compartiendo…" : "Aprobar y compartir con paciente"}
          </button>
          {!canPublish && !screening.patientPublishedAt ? <p className="permission-note">Requiere revisión profesional completada y screening revisado.</p> : null}
        </section>
        <section className="workflow-card closure-card">
          <p className="eyebrow">Finalizar visita</p>
          <div className="panel-title"><ClipboardCheck aria-hidden="true" size={20} /><h3>Checklist de cierre</h3></div>
          <p className="field-help">El cierre congela el workflow clínico y conserva su trazabilidad. Complete todos los puntos antes de cerrar.</p>
          <ul className="closure-checklist">
            {checklist.items.map((item) => <li className={item.complete ? "complete" : "missing"} key={item.key}>{item.complete ? <Check aria-hidden="true" size={17} /> : <X aria-hidden="true" size={17} />}<span><span className="sr-only">{item.complete ? "Completado: " : "Pendiente: "}</span>{item.label}</span></li>)}
          </ul>
          {!checklist.canClose && !closed ? <p className="form-message">Falta: {checklist.missing.join(", ")}.</p> : null}
          <button className="primary-button" disabled={workflow.saving || !workflow.canClose || !checklist.canClose || closed} onClick={() => void closeScreening()} type="button">
            <ClipboardCheck aria-hidden="true" size={18} />{closed ? "Screening cerrado" : "Cerrar screening"}
          </button>
          {!workflow.canClose ? <p className="permission-note">Su rol puede consultar el estado, pero no cerrar el screening.</p> : null}
        </section>
      </div>
    </section>
  );
}

function ProfessionalReviewForm({ disabled, review, onSave }: { disabled: boolean; review: ReturnType<typeof useClinicalWorkflow>["detail"]["professionalReview"]; onSave: (data: ReturnType<typeof professionalReviewSchema.parse>) => Promise<void> }) {
  const [form, setForm] = useState<ProfessionalReviewInput>({ reviewStatus: "PENDIENTE_REVISION", structuredObservations: emptyObservations, notes: "" });
  useEffect(() => {
    setForm(review ? { reviewStatus: review.reviewStatus, structuredObservations: review.structuredObservations, notes: review.notes ?? "" } : { reviewStatus: "PENDIENTE_REVISION", structuredObservations: emptyObservations, notes: "" });
  }, [review]);
  const observationLabels: Record<keyof StructuredObservations, string> = {
    insufficientQuality: "Calidad insuficiente", repeatedImageRecommended: "Imagen repetida recomendada",
    newCaptureRequired: "Requiere nueva captura", reviewCompleted: "Revision completada",
    followUpRecommended: "Seguimiento recomendado", referralRecommended: "Referencia recomendada",
  };
  async function submit(event: FormEvent) { event.preventDefault(); const parsed = professionalReviewSchema.safeParse(form); if (parsed.success) await onSave(parsed.data); }
  return <form className="workflow-card professional-review-card" onSubmit={(event) => void submit(event)}>
    <p className="eyebrow">Evaluación clínica</p>
    <div className="panel-title"><ClipboardCheck aria-hidden="true" size={20} /><h3>Revisión profesional</h3></div>
    <p className="field-help">Un profesional autorizado registra aquí la revisión manual y las acciones siguientes. No es una conclusión generada por IA.</p>
    <label>Estado<select disabled={disabled} value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as ProfessionalReviewInput["reviewStatus"] }))}>{professionalReviewStatusValues.filter((value) => value !== "CERRADO" || review?.reviewStatus === "CERRADO").map((value) => <option key={value} value={value}>{professionalReviewStatusLabels[value]}</option>)}</select></label>
    <fieldset className="structured-observations clinical-fieldset"><legend>Observaciones de la revisión</legend>{Object.entries(observationLabels).map(([key, label]) => <label className="checkbox-field" key={key}><input checked={Boolean(form.structuredObservations[key as keyof StructuredObservations])} disabled={disabled} onChange={(event) => setForm((current) => ({ ...current, structuredObservations: { ...current.structuredObservations, [key]: event.target.checked } }))} type="checkbox" />{label}</label>)}</fieldset>
    <label>Comentarios adicionales<textarea disabled={disabled} maxLength={1600} rows={4} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />Guardar revision</button>
  </form>;
}

const defaultFollowUp = (): FollowUpInput => ({ assignedTo: "", followUpType: "CONTROL_PROGRAMADO", followUpStatus: "SIN_SEGUIMIENTO", urgency: "normal", dueDate: "", completedAt: null, notes: "" });
function FollowUpPanel({ disabled, followUps, onSave }: { disabled: boolean; followUps: FollowUp[]; onSave: (data: ReturnType<typeof followUpSchema.parse>, current?: FollowUp) => Promise<void> }) {
  const [editing, setEditing] = useState<FollowUp | undefined>(); const [form, setForm] = useState<FollowUpInput>(defaultFollowUp()); const [formError, setFormError] = useState<string | null>(null);
  function edit(item: FollowUp) { setEditing(item); setForm({ assignedTo: item.assignedTo ?? "", followUpType: item.followUpType, followUpStatus: item.followUpStatus, urgency: item.urgency, dueDate: item.dueDate ?? "", completedAt: item.completedAt, notes: item.notes ?? "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); const candidate = { ...form, completedAt: form.followUpStatus === "SEGUIMIENTO_COMPLETADO" ? (editing?.completedAt ?? new Date().toISOString()) : null }; const parsed = followUpSchema.safeParse(candidate); if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Revise los datos del seguimiento."); return; } setFormError(null); await onSave(parsed.data, editing); setEditing(undefined); setForm(defaultFollowUp()); }
  return <form className="workflow-card follow-up-card" onSubmit={(event) => void submit(event)}><p className="eyebrow">Continuidad de atención</p><div className="panel-title"><Save aria-hidden="true" size={20} /><h3>Seguimiento</h3></div>
    <p className="field-help">Programe el próximo control y registre su responsable y prioridad.</p>
    <div className="workflow-form-fields">
    <label>Tipo<select disabled={disabled} value={form.followUpType} onChange={(event) => setForm((c) => ({ ...c, followUpType: event.target.value as FollowUpInput["followUpType"] }))}>{followUpTypeValues.map((v) => <option key={v} value={v}>{followUpTypeLabels[v]}</option>)}</select></label>
    <label>Estado<select disabled={disabled} value={form.followUpStatus} onChange={(event) => setForm((c) => ({ ...c, followUpStatus: event.target.value as FollowUpInput["followUpStatus"] }))}>{followUpStatusValues.map((v) => <option key={v} value={v}>{followUpStatusLabels[v]}</option>)}</select></label>
    <label>Fecha de la cita o seguimiento<input disabled={disabled} type="date" value={form.dueDate ?? ""} onChange={(event) => setForm((c) => ({ ...c, dueDate: event.target.value }))} /></label>
    <label>Prioridad indicada por el profesional<select disabled={disabled} value={form.urgency ?? "normal"} onChange={(event) => setForm((c) => ({ ...c, urgency: event.target.value as "normal" | "urgent" }))}><option value="normal">Normal</option><option value="urgent">Urgente</option></select><span className="field-help">Es una etiqueta manual para la agenda, no un diagnóstico automático.</span></label>
    <label>Responsable del seguimiento (opcional)<input aria-describedby="follow-up-assignee-help" disabled={disabled} placeholder="Identificador interno, si aplica" value={form.assignedTo ?? ""} onChange={(event) => setForm((c) => ({ ...c, assignedTo: event.target.value }))} /><span className="field-help" id="follow-up-assignee-help">Use el identificador interno de la persona responsable. Puede dejarlo vacío.</span></label>
    <label>Notas<textarea disabled={disabled} maxLength={1200} rows={3} value={form.notes ?? ""} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} /></label>
    </div>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />{editing ? "Actualizar" : "Registrar"} seguimiento</button>
    {formError ? <div className="form-error" role="alert">{formError}</div> : null}
    {followUps.length === 0 ? <EmptyState title="Sin seguimientos" description="Registre un seguimiento solo cuando el profesional lo indique." /> : null}
    <ul className="workflow-records">{followUps.map((item) => <li key={item.id}><span><strong>{followUpTypeLabels[item.followUpType]}</strong>{followUpStatusLabels[item.followUpStatus]}{item.dueDate ? ` · ${item.dueDate}` : ""}{item.urgency === "urgent" ? " · Urgente" : ""}</span><button className="ghost-button" disabled={disabled} onClick={() => edit(item)} type="button">Editar</button></li>)}</ul>
  </form>;
}

const defaultReferral = (): ReferralInput => ({ referralReason: "", referralDestination: "", referralStatus: "BORRADOR", requestedDate: new Date().toISOString().slice(0, 10), completedDate: "", notes: "" });
function ReferralPanel({ disabled, referrals, onSave }: { disabled: boolean; referrals: Referral[]; onSave: (data: ReturnType<typeof referralSchema.parse>, current?: Referral) => Promise<void> }) {
  const [editing, setEditing] = useState<Referral | undefined>(); const [form, setForm] = useState<ReferralInput>(defaultReferral()); const [formError, setFormError] = useState<string | null>(null);
  function edit(item: Referral) { setEditing(item); setForm({ referralReason: item.referralReason, referralDestination: item.referralDestination, referralStatus: item.referralStatus, requestedDate: item.requestedDate, completedDate: item.completedDate ?? "", notes: item.notes ?? "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); const candidate = { ...form, completedDate: form.referralStatus === "COMPLETADA" ? (form.completedDate || new Date().toISOString().slice(0, 10)) : form.completedDate }; const parsed = referralSchema.safeParse(candidate); if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Revise los datos de la referencia."); return; } setFormError(null); await onSave(parsed.data, editing); setEditing(undefined); setForm(defaultReferral()); }
  return <form className="workflow-card referral-card" onSubmit={(event) => void submit(event)}><p className="eyebrow">Atención especializada</p><div className="panel-title"><ExternalLink aria-hidden="true" size={20} /><h3>Referencia</h3></div>
    <p className="field-help">Documente el motivo, destino y avance de la referencia indicada.</p>
    <div className="workflow-form-fields">
    <label>Motivo<input disabled={disabled} maxLength={500} value={form.referralReason} onChange={(event) => setForm((c) => ({ ...c, referralReason: event.target.value }))} /></label>
    <label>Destino<input disabled={disabled} maxLength={300} value={form.referralDestination} onChange={(event) => setForm((c) => ({ ...c, referralDestination: event.target.value }))} /></label>
    <label>Fecha solicitada<input disabled={disabled} type="date" value={form.requestedDate} onChange={(event) => setForm((c) => ({ ...c, requestedDate: event.target.value }))} /></label>
    <label>Estado<select disabled={disabled} value={form.referralStatus} onChange={(event) => setForm((c) => ({ ...c, referralStatus: event.target.value as ReferralInput["referralStatus"] }))}>{referralStatusValues.map((v) => <option key={v} value={v}>{referralStatusLabels[v]}</option>)}</select></label>
    <label>Fecha completada<input disabled={disabled || form.referralStatus !== "COMPLETADA"} type="date" value={form.completedDate ?? ""} onChange={(event) => setForm((c) => ({ ...c, completedDate: event.target.value }))} /></label>
    <label>Notas<textarea disabled={disabled} maxLength={1200} rows={3} value={form.notes ?? ""} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} /></label>
    </div>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />{editing ? "Actualizar" : "Registrar"} referencia</button>
    {formError ? <div className="form-error" role="alert">{formError}</div> : null}
    {referrals.length === 0 ? <EmptyState title="Sin referencias" description="Las referencias manuales aparecerán aquí cuando se registren." /> : null}
    <ul className="workflow-records">{referrals.map((item) => <li key={item.id}><span><strong>{item.referralDestination}</strong>{referralStatusLabels[item.referralStatus]} · {item.requestedDate}</span><button className="ghost-button" disabled={disabled} onClick={() => edit(item)} type="button">Editar</button></li>)}</ul>
  </form>;
}
