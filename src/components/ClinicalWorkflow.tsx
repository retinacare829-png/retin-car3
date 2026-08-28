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
import { betaAiUnavailableMessage, retinalImageLateralityLabels, type ScreeningDetail } from "../domain/screening";
import { useClinicalWorkflow } from "../hooks/useClinicalWorkflow";
import { EmptyState, getStatusTone, LoadingState, StatusBadge } from "./ui";

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
          <p>{patient.lastNames}, {patient.firstNames} · {patient.medicalRecordCode}</p>
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

      <div className="ai-placeholder" role="status"><strong>{betaAiUnavailableMessage}</strong><code>NOT_AVAILABLE</code></div>
      {workflow.error ? <div className="form-error">{workflow.error}</div> : null}
      {workflow.loading ? <LoadingState label="Cargando workflow clínico" /> : null}
      {!workflow.loading && !workflow.detail.professionalReview ? <EmptyState title="Sin revisión profesional" description="Complete la revisión manual cuando un profesional autorizado haya evaluado el screening." /> : null}

      <div className="workflow-grid">
        <ProfessionalReviewForm disabled={workflow.saving || !workflow.canReview || closed} review={workflow.detail.professionalReview} onSave={workflow.saveReview} />
        <FollowUpPanel disabled={workflow.saving || !workflow.canWriteFollowUps || closed} followUps={workflow.detail.followUps} onSave={workflow.saveFollowUp} />
        <ReferralPanel disabled={workflow.saving || !workflow.canWriteReferrals || closed} referrals={workflow.detail.referrals} onSave={workflow.saveReferral} />
        <section className="workflow-card closure-card">
          <div className="panel-title"><ClipboardCheck aria-hidden="true" size={20} /><h3>Checklist de cierre</h3></div>
          <ul className="closure-checklist">
            {checklist.items.map((item) => <li className={item.complete ? "complete" : "missing"} key={item.key}>{item.complete ? <Check size={17} /> : <X size={17} />}<span>{item.label}</span></li>)}
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
  return <form className="workflow-card" onSubmit={(event) => void submit(event)}>
    <div className="panel-title"><ClipboardCheck size={20} /><h3>Revision profesional</h3></div>
    <label>Estado<select disabled={disabled} value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as ProfessionalReviewInput["reviewStatus"] }))}>{professionalReviewStatusValues.filter((value) => value !== "CERRADO" || review?.reviewStatus === "CERRADO").map((value) => <option key={value} value={value}>{professionalReviewStatusLabels[value]}</option>)}</select></label>
    <div className="structured-observations">{Object.entries(observationLabels).map(([key, label]) => <label className="checkbox-field" key={key}><input checked={Boolean(form.structuredObservations[key as keyof StructuredObservations])} disabled={disabled} onChange={(event) => setForm((current) => ({ ...current, structuredObservations: { ...current.structuredObservations, [key]: event.target.checked } }))} type="checkbox" />{label}</label>)}</div>
    <label>Comentarios adicionales<textarea disabled={disabled} maxLength={1600} rows={4} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />Guardar revision</button>
  </form>;
}

const defaultFollowUp = (): FollowUpInput => ({ assignedTo: "", followUpType: "CONTROL_PROGRAMADO", followUpStatus: "SIN_SEGUIMIENTO", dueDate: "", completedAt: null, notes: "" });
function FollowUpPanel({ disabled, followUps, onSave }: { disabled: boolean; followUps: FollowUp[]; onSave: (data: ReturnType<typeof followUpSchema.parse>, current?: FollowUp) => Promise<void> }) {
  const [editing, setEditing] = useState<FollowUp | undefined>(); const [form, setForm] = useState<FollowUpInput>(defaultFollowUp());
  function edit(item: FollowUp) { setEditing(item); setForm({ assignedTo: item.assignedTo ?? "", followUpType: item.followUpType, followUpStatus: item.followUpStatus, dueDate: item.dueDate ?? "", completedAt: item.completedAt, notes: item.notes ?? "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); const candidate = { ...form, completedAt: form.followUpStatus === "SEGUIMIENTO_COMPLETADO" ? (editing?.completedAt ?? new Date().toISOString()) : null }; const parsed = followUpSchema.safeParse(candidate); if (parsed.success) { await onSave(parsed.data, editing); setEditing(undefined); setForm(defaultFollowUp()); } }
  return <form className="workflow-card" onSubmit={(event) => void submit(event)}><div className="panel-title"><Save size={20} /><h3>Seguimiento</h3></div>
    <label>Tipo<select disabled={disabled} value={form.followUpType} onChange={(event) => setForm((c) => ({ ...c, followUpType: event.target.value as FollowUpInput["followUpType"] }))}>{followUpTypeValues.map((v) => <option key={v} value={v}>{followUpTypeLabels[v]}</option>)}</select></label>
    <label>Estado<select disabled={disabled} value={form.followUpStatus} onChange={(event) => setForm((c) => ({ ...c, followUpStatus: event.target.value as FollowUpInput["followUpStatus"] }))}>{followUpStatusValues.map((v) => <option key={v} value={v}>{followUpStatusLabels[v]}</option>)}</select></label>
    <label>Fecha sugerida<input disabled={disabled} type="date" value={form.dueDate ?? ""} onChange={(event) => setForm((c) => ({ ...c, dueDate: event.target.value }))} /></label>
    <label>Responsable (UUID, opcional)<input disabled={disabled} value={form.assignedTo ?? ""} onChange={(event) => setForm((c) => ({ ...c, assignedTo: event.target.value }))} /></label>
    <label>Notas<textarea disabled={disabled} maxLength={1200} rows={3} value={form.notes ?? ""} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} /></label>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />{editing ? "Actualizar" : "Registrar"} seguimiento</button>
    {followUps.length === 0 ? <EmptyState title="Sin seguimientos" description="Registre un seguimiento solo cuando el profesional lo indique." /> : null}
    <ul className="workflow-records">{followUps.map((item) => <li key={item.id}><span><strong>{followUpTypeLabels[item.followUpType]}</strong>{followUpStatusLabels[item.followUpStatus]}{item.dueDate ? ` · ${item.dueDate}` : ""}</span><button className="ghost-button" disabled={disabled} onClick={() => edit(item)} type="button">Editar</button></li>)}</ul>
  </form>;
}

const defaultReferral = (): ReferralInput => ({ referralReason: "", referralDestination: "", referralStatus: "BORRADOR", requestedDate: new Date().toISOString().slice(0, 10), completedDate: "", notes: "" });
function ReferralPanel({ disabled, referrals, onSave }: { disabled: boolean; referrals: Referral[]; onSave: (data: ReturnType<typeof referralSchema.parse>, current?: Referral) => Promise<void> }) {
  const [editing, setEditing] = useState<Referral | undefined>(); const [form, setForm] = useState<ReferralInput>(defaultReferral());
  function edit(item: Referral) { setEditing(item); setForm({ referralReason: item.referralReason, referralDestination: item.referralDestination, referralStatus: item.referralStatus, requestedDate: item.requestedDate, completedDate: item.completedDate ?? "", notes: item.notes ?? "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); const candidate = { ...form, completedDate: form.referralStatus === "COMPLETADA" ? (form.completedDate || new Date().toISOString().slice(0, 10)) : form.completedDate }; const parsed = referralSchema.safeParse(candidate); if (parsed.success) { await onSave(parsed.data, editing); setEditing(undefined); setForm(defaultReferral()); } }
  return <form className="workflow-card" onSubmit={(event) => void submit(event)}><div className="panel-title"><ExternalLink size={20} /><h3>Referencia</h3></div>
    <label>Motivo<input disabled={disabled} maxLength={500} value={form.referralReason} onChange={(event) => setForm((c) => ({ ...c, referralReason: event.target.value }))} /></label>
    <label>Destino<input disabled={disabled} maxLength={300} value={form.referralDestination} onChange={(event) => setForm((c) => ({ ...c, referralDestination: event.target.value }))} /></label>
    <label>Fecha solicitada<input disabled={disabled} type="date" value={form.requestedDate} onChange={(event) => setForm((c) => ({ ...c, requestedDate: event.target.value }))} /></label>
    <label>Estado<select disabled={disabled} value={form.referralStatus} onChange={(event) => setForm((c) => ({ ...c, referralStatus: event.target.value as ReferralInput["referralStatus"] }))}>{referralStatusValues.map((v) => <option key={v} value={v}>{referralStatusLabels[v]}</option>)}</select></label>
    <label>Fecha completada<input disabled={disabled || form.referralStatus !== "COMPLETADA"} type="date" value={form.completedDate ?? ""} onChange={(event) => setForm((c) => ({ ...c, completedDate: event.target.value }))} /></label>
    <label>Notas<textarea disabled={disabled} maxLength={1200} rows={3} value={form.notes ?? ""} onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))} /></label>
    <button className="primary-button" disabled={disabled} type="submit"><Save size={18} />{editing ? "Actualizar" : "Registrar"} referencia</button>
    {referrals.length === 0 ? <EmptyState title="Sin referencias" description="Las referencias manuales aparecerán aquí cuando se registren." /> : null}
    <ul className="workflow-records">{referrals.map((item) => <li key={item.id}><span><strong>{item.referralDestination}</strong>{referralStatusLabels[item.referralStatus]} · {item.requestedDate}</span><button className="ghost-button" disabled={disabled} onClick={() => edit(item)} type="button">Editar</button></li>)}</ul>
  </form>;
}
