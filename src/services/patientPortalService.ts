import { parsePatientPortalSnapshot, type PatientPortalAdapter } from "../domain/patientPortal";
import type { TypedSupabaseClient } from "../lib/supabase";

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
      return parsePatientPortalSnapshot(data);
    },
  };
}
