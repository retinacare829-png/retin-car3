import { parsePatientPortalSnapshot, type PatientPortalAdapter } from "../domain/patientPortal";
import type { TypedSupabaseClient } from "../lib/supabase";
import { z } from "zod";
import { patientRetinalAnnexSchema } from "../domain/retinalReport";

/**
 * Canonical backend adapter: public.get_patient_portal_snapshot() has no
 * parameters and derives the patient from the authenticated session.
 */
export function createPatientPortalAdapter(client: TypedSupabaseClient): PatientPortalAdapter {
  return {
    async getSnapshot() {
      const { data, error } = await client.rpc("get_patient_portal_snapshot", {});
      if (error) throw error;
      if (!data) throw new Error("No se encontró una cuenta paciente vinculada.");
      const { data: annexData, error: annexError } = await client.rpc("get_patient_retinal_reports", {});
      if (annexError) throw new Error("No se pudieron cargar los anexos del informe. Intente nuevamente.");
      const annexes = z.array(patientRetinalAnnexSchema).parse(annexData);
      const snapshot = parsePatientPortalSnapshot(data);
      return { ...snapshot, reports: snapshot.reports.map(report => ({ ...report,
        retinalAnnex: annexes.find(annex => annex.screeningId === report.screeningId),
      })) };
    },
  };
}
