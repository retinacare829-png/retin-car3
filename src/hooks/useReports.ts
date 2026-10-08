import { useCallback, useEffect, useMemo, useState } from "react";
import { friendlyError, subscribeToDataInvalidation } from "../lib/appEvents";
import { supabase } from "../lib/supabase";
import type { ReportData } from "../domain/report";
import { ReportService } from "../services/reportService";

const emptyReportData: ReportData = { patients: [], screenings: [], reviews: [], followUps: [], images: [] };

export function useReports(organizationId: string) {
  const service = useMemo(() => (supabase ? new ReportService(supabase) : null), []);
  const [data, setData] = useState<ReportData>(emptyReportData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!service) {
      setLoading(false);
      setError("Supabase no está configurado.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await service.getReportData(organizationId));
    } catch (caught) {
      setError(friendlyError(caught, "No fue posible cargar los datos de reportes."));
    } finally {
      setLoading(false);
    }
  }, [organizationId, service]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const unsubscribeDashboard = subscribeToDataInvalidation("dashboard", () => void reload());
    const unsubscribeReports = subscribeToDataInvalidation("reports", () => void reload());
    return () => { unsubscribeDashboard(); unsubscribeReports(); };
  }, [reload]);

  return { data, loading, error, reload };
}
