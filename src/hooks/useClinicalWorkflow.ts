import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { can } from "../domain/permissions";
import type { FollowUp, FollowUpData, ProfessionalReviewData, Referral, ReferralData, ClinicalWorkflowDetail } from "../domain/clinicalWorkflow";
import type { Role } from "../domain/roles";
import { supabase } from "../lib/supabase";
import { ClinicalWorkflowService } from "../services/clinicalWorkflowService";
import { friendlyError, invalidateData, notify } from "../lib/appEvents";

const emptyDetail: ClinicalWorkflowDetail = { professionalReview: null, followUps: [], referrals: [] };

export function useClinicalWorkflow(organizationId: string, patientId: string, screeningId: string, role: Role, user: User) {
  const service = useMemo(() => (supabase ? new ClinicalWorkflowService(supabase) : null), []);
  const [detail, setDetail] = useState<ClinicalWorkflowDetail>(emptyDetail);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRead = can(role, "workflow:read");
  const canReview = can(role, "workflow:review");
  const canWriteFollowUps = can(role, "followups:write");
  const canWriteReferrals = can(role, "referrals:write");
  const canClose = can(role, "screenings:close");

  const context = useMemo(() => ({ organizationId, patientId, screeningId, actorUserId: user.id }), [organizationId, patientId, screeningId, user.id]);
  const reload = useCallback(async () => {
    if (!service || !canRead) { setDetail(emptyDetail); return; }
    setLoading(true); setError(null);
    try { setDetail(await service.getDetail(context)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar el workflow clinico."); }
    finally { setLoading(false); }
  }, [canRead, context, service]);

  useEffect(() => { void reload(); }, [reload]);

  async function mutate(operation: () => Promise<void>) {
    if (!service) throw new Error("Supabase no esta configurado.");
    setSaving(true); setError(null);
    try { await operation(); await reload(); }
    catch (caught) { const message = friendlyError(caught, "No se pudo guardar el cambio clínico."); setError(message); notify(message, "error"); throw caught; }
    finally { setSaving(false); }
  }

  return {
    detail, loading, saving, error, canRead, canReview, canWriteFollowUps, canWriteReferrals, canClose, reload,
    saveReview: (data: ProfessionalReviewData) => mutate(async () => {
      if (!canReview) throw new Error("Su rol no permite emitir una revision profesional.");
      await service?.saveProfessionalReview(context, data);
      invalidateData("dashboard", "screenings"); notify("Revisión profesional actualizada.");
    }),
    saveFollowUp: (data: FollowUpData, current?: FollowUp) => mutate(async () => {
      if (!canWriteFollowUps) throw new Error("Su rol no permite registrar seguimientos.");
      if (current) await service?.updateFollowUp(context, current, data); else await service?.createFollowUp(context, data);
      invalidateData("dashboard", "screenings"); notify(current ? "Seguimiento actualizado." : "Seguimiento registrado.");
    }),
    saveReferral: (data: ReferralData, current?: Referral) => mutate(async () => {
      if (!canWriteReferrals) throw new Error("Su rol no permite registrar referencias.");
      if (current) await service?.updateReferral(context, current, data); else await service?.createReferral(context, data);
      invalidateData("dashboard", "screenings"); notify(current ? "Referencia actualizada." : "Referencia registrada.");
    }),
    closeScreening: () => mutate(async () => {
      if (!canClose) throw new Error("Su rol no permite cerrar screenings.");
      await service?.closeScreening(context);
      invalidateData("dashboard", "screenings"); notify("Screening cerrado correctamente.");
    }),
  };
}
