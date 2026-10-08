import { useCallback, useEffect, useState } from "react";
import type { PatientPortalAdapter, PatientPortalSnapshot } from "../domain/patientPortal";

interface PatientPortalState {
  data: PatientPortalSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function usePatientPortal(adapter?: PatientPortalAdapter): PatientPortalState & { reload: () => void } {
  const [state, setState] = useState<PatientPortalState>({ data: null, loading: Boolean(adapter), error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    if (!adapter) {
      setState({ data: null, loading: false, error: "El acceso del portal paciente todavía no está configurado." });
      return () => { mounted = false; };
    }

    setState({ data: null, loading: true, error: null });
    adapter.getSnapshot()
      .then((data) => { if (mounted) setState({ data, loading: false, error: null }); })
      .catch((caught: unknown) => {
        if (mounted) setState({ data: null, loading: false, error: caught instanceof Error ? caught.message : "No fue posible cargar tu portal." });
      });

    return () => { mounted = false; };
  }, [adapter, reloadToken]);

  const reload = useCallback(() => setReloadToken((current) => current + 1), []);
  return { ...state, reload };
}
