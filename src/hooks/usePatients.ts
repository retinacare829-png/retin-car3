import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { can } from "../domain/permissions";
import type { Patient, PatientCodePreview, PatientCreateData, PatientUpdateData } from "../domain/patient";
import type { Role } from "../domain/roles";
import { supabase } from "../lib/supabase";
import { PatientService } from "../services/patientService";
import { friendlyError, invalidateData, notify, subscribeToDataInvalidation } from "../lib/appEvents";

export interface UsePatientsResult {
  patients: Patient[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  previewCodes: PatientCodePreview | null;
  canWritePatients: boolean;
  reload: () => Promise<void>;
  createPatient: (data: PatientCreateData, requestId?: string) => Promise<void>;
  updatePatient: (patient: Patient, data: PatientUpdateData) => Promise<void>;
  archivePatient: (patientId: string) => Promise<void>;
  restorePatient: (patientId: string) => Promise<void>;
}

export function usePatients(
  organizationId: string | null,
  role: Role | null,
  user: User | null,
  includeArchived: boolean,
  query: string,
): UsePatientsResult {
  const service = useMemo(() => (supabase ? new PatientService(supabase) : null), []);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCodes, setPreviewCodes] = useState<PatientCodePreview | null>(null);
  const canWritePatients = role ? can(role, "patients:write") : false;

  const reload = useCallback(async () => {
    if (!service || !organizationId) {
      setPatients([]);
      setPreviewCodes(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextPatients = await service.listPatients({ organizationId, includeArchived, query });
      setPatients(nextPatients);
      if (canWritePatients) {
        try {
          setPreviewCodes(await service.previewPatientCodes(organizationId));
        } catch {
          setPreviewCodes(null);
        }
      } else {
        setPreviewCodes(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pacientes.");
    } finally {
      setLoading(false);
    }
  }, [canWritePatients, includeArchived, organizationId, query, service]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => subscribeToDataInvalidation("patients", () => void reload()), [reload]);

  async function mutate(operation: () => Promise<void>) {
    if (!service || !organizationId || !user) {
      throw new Error("No hay contexto de organizacion activo.");
    }

    if (!canWritePatients) {
      throw new Error("Su rol no permite modificar pacientes.");
    }

    setSaving(true);
    setError(null);
    try {
      await operation();
      await reload();
    } catch (caught) {
      const message = friendlyError(caught, "No se pudo guardar el cambio.");
      setError(message); notify(message, "error");
      throw caught;
    } finally {
      setSaving(false);
    }
  }

  return {
    patients,
    loading,
    saving,
    error,
    previewCodes,
    canWritePatients,
    reload,
    createPatient: async (data, requestId) =>
      mutate(async () => {
        await service?.createPatient({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, data, requestId);
        invalidateData("dashboard"); notify("Paciente creado correctamente.");
      }),
    updatePatient: async (patient, data) =>
      mutate(async () => {
        await service?.updatePatient({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, patient, data);
        invalidateData("dashboard"); notify("Paciente actualizado correctamente.");
      }),
    archivePatient: async (patientId) =>
      mutate(async () => {
        await service?.archivePatient({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, patientId);
        invalidateData("dashboard"); notify("Paciente archivado correctamente.");
      }),
    restorePatient: async (patientId) =>
      mutate(async () => {
        await service?.restorePatient({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, patientId);
        invalidateData("dashboard"); notify("Paciente restaurado correctamente.");
      }),
  };
}
