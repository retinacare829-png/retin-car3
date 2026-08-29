import { useEffect, useMemo, useState } from "react";
import { emptyDashboardData, type DashboardData } from "../domain/dashboard";
import { supabase } from "../lib/supabase";
import { DashboardService } from "../services/dashboardService";
import { friendlyError, subscribeToDataInvalidation } from "../lib/appEvents";

export function useDashboard(organizationId: string) {
  const service = useMemo(() => supabase ? new DashboardService(supabase) : null, []);
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true; setLoading(true); setError(null);
    if (!service) { setLoading(false); setError("Supabase no está configurado."); return; }
    const load = (showLoading = true) => { if (showLoading) setLoading(true); service.getDashboard(organizationId).then((result) => { if (mounted) setData(result); }).catch((caught: unknown) => { if (mounted) setError(friendlyError(caught, "No fue posible cargar el dashboard.")); }).finally(() => { if (mounted) setLoading(false); }); };
    load();
    const unsubscribe = subscribeToDataInvalidation("dashboard", () => load(false));
    return () => { mounted = false; unsubscribe(); };
  }, [organizationId, service]);
  return { data, loading, error };
}
