import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { can } from "../domain/permissions";
import type { Patient, PatientCodePreview, PatientCreateData, PatientUpdateData } from "../domain/patient";
import type { PatientPortalAccount } from "../domain/patientPortal";
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
  patientPortalAccount: PatientPortalAccount | null;
  patientPortalLoading: boolean;
  canManagePatientPortal: boolean;
  canWritePatients: boolean;
  reload: () => Promise<void>;
  createPatient: (data: PatientCreateData, requestId: string) => Promise<Patient>;
  updatePatient: (patient: Patient, data: PatientUpdateData) => Promise<void>;
  archivePatient: (patientId: string) => Promise<void>;
  restorePatient: (patientId: string) => Promise<void>;
  loadPatientPortalAccount: (patientId: string) => Promise<void>;
  linkPatientPortalAccount: (patientId: string, userId: string) => Promise<void>;
  revokePatientPortalAccount: (patientId: string) => Promise<void>;
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
  const [patientPortalAccount, setPatientPortalAccount] = useState<PatientPortalAccount | null>(null);
  const [patientPortalLoading, setPatientPortalLoading] = useState(false);
  const canWritePatients = role ? can(role, "patients:write") : false;
  const canManagePatientPortal = role === "clinic_admin";

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

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (!service || !organizationId || !user) {
      throw new Error("No hay contexto de organizacion activo.");
    }

    if (!canWritePatients) {
      throw new Error("Su rol no permite modificar pacientes.");
    }

    setSaving(true);
    setError(null);
    try {
      const result = await operation();
      await reload();
      return result;
    } catch (caught) {
      const message = friendlyError(caught, "No se pudo guardar el cambio.");
      setError(message); notify(message, "error");
      throw caught;
    } finally {
      setSaving(false);
    }
  }

  const loadPatientPortalAccount = useCallback(async (patientId: string) => {
    if (!service || !organizationId || !canManagePatientPortal) {
      setPatientPortalAccount(null);
      return;
    }

    setPatientPortalLoading(true);
    try {
      setPatientPortalAccount(await service.getPatientPortalAccount(
        { organizationId, actorUserId: user?.id ?? "" },
        patientId,
      ));
    } catch (caught) {
      const message = friendlyError(caught, "No se pudo consultar el acceso al portal.");
      setError(message);
      notify(message, "error");
      setPatientPortalAccount(null);
    } finally {
      setPatientPortalLoading(false);
    }
  }, [canManagePatientPortal, organizationId, service, user?.id]);

  return {
    patients,
    loading,
    saving,
    error,
    previewCodes,
    patientPortalAccount,
    patientPortalLoading,
    canManagePatientPortal,
    canWritePatients,
    reload,
    createPatient: async (data, requestId) =>
      mutate(async () => {
        const created = await service?.createPatient({ organizationId: organizationId ?? "", actorUserId: user?.id ?? "" }, data, requestId);
        if (!created) throw new Error("No se recibió la ficha creada.");
        invalidateData("dashboard"); notify("Paciente creado correctamente.");
        return created;
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
    loadPatientPortalAccount,
    linkPatientPortalAccount: async (patientId, userId) => {
      const linked = await mutate(async () => {
        if (!service) throw new Error("No hay servicio de pacientes disponible.");
        return service.linkPatientPortalAccount(
          { organizationId: organizationId ?? "", actorUserId: user?.id ?? "" },
          patientId,
          userId,
        );
      });
      setPatientPortalAccount(linked);
      notify("Cuenta de paciente vinculada correctamente.");
    },
    revokePatientPortalAccount: async (patientId) => {
      const revoked = await mutate(async () => {
        if (!service) throw new Error("No hay servicio de pacientes disponible.");
        return service.revokePatientPortalAccount(
          { organizationId: organizationId ?? "", actorUserId: user?.id ?? "" },
          patientId,
        );
      });
      setPatientPortalAccount(revoked);
      notify("Acceso al portal revocado.");
    },
  };
}
