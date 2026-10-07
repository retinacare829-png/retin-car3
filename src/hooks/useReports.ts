import { useEffect, useState } from "react";

export type ReportView = "patients" | "screenings" | "operations";
export type ReportStatusFilter = "all" | "pending" | "in_review" | "completed" | "follow_up";

export interface ReportFilters {
  query: string;
  status: ReportStatusFilter;
  from: string;
  to: string;
}

export interface PatientReportRow {
  id: string;
  patientName: string;
  identifier: string;
  screenings: number;
  lastActivityAt: string | null;
  lastStatusLabel: string;
  followUps: number;
}

export interface ScreeningReportRow {
  id: string;
  patientName: string;
  patientIdentifier: string;
  createdAt: string;
  statusLabel: string;
  qualityLabel: string;
  reviewLabel: string;
  followUpLabel: string;
  odAvailable?: boolean;
  oiAvailable?: boolean;
  referenceLabel?: string;
}

export interface OperationMetric {
  id: string;
  label: string;
  value: number;
  detail: string;
}

export interface ReportsSnapshot {
  generatedAt: string;
  patientRows: PatientReportRow[];
  screeningRows: ScreeningReportRow[];
  operationMetrics: OperationMetric[];
}

export interface ReportsQuery {
  organizationId: string;
  filters: ReportFilters;
}

/**
 * UI boundary for the backend report service. The adapter maps the backend
 * response to these non-diagnostic, presentation-focused rows.
 */
export interface ReportsAdapter {
  getSnapshot: (query: ReportsQuery) => Promise<ReportsSnapshot>;
}

export const defaultReportFilters: ReportFilters = {
  query: "",
  status: "all",
  from: "",
  to: "",
};

interface ReportsState {
  data: ReportsSnapshot | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

export function useReports(
  organizationId: string,
  filters: ReportFilters,
  adapter?: ReportsAdapter,
): ReportsState & { reload: () => void } {
  const [state, setState] = useState<ReportsState>({ data: null, loading: false, error: null, notConfigured: !adapter });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    if (!adapter) {
      setState({ data: null, loading: false, error: null, notConfigured: true });
      return () => {
        mounted = false;
      };
    }

    setState((current) => ({ ...current, loading: true, error: null, notConfigured: false }));
    adapter
      .getSnapshot({ organizationId, filters })
      .then((data) => {
        if (mounted) setState({ data, loading: false, error: null, notConfigured: false });
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setState({
            data: null,
            loading: false,
            error: caught instanceof Error ? caught.message : "No fue posible cargar los reportes.",
            notConfigured: false,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [adapter, filters, organizationId, reloadToken]);

  return { ...state, reload: () => setReloadToken((current) => current + 1) };
}
