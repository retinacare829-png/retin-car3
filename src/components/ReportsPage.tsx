import { AlertCircle, CalendarDays, FileText, Filter, LayoutDashboard, Printer, RefreshCw, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { can } from "../domain/permissions";
import type { Role } from "../domain/roles";
import {
  defaultReportFilters,
  type ReportFilters,
  type ReportsAdapter,
  type ReportStatusFilter,
  type ReportView,
  useReports,
} from "../hooks/useReports";
import { EmptyState, LoadingState } from "./ui";

interface ReportsPageProps {
  organizationId: string;
  organizationName: string;
  role: Role;
  adapter?: ReportsAdapter;
}

const viewLabels: Record<ReportView, string> = {
  patients: "Por paciente",
  screenings: "Por screening",
  operations: "Operación",
};

const statusLabels: Record<ReportStatusFilter, string> = {
  all: "Todos los estados",
  pending: "Pendientes",
  in_review: "En revisión",
  completed: "Completados",
  follow_up: "Con seguimiento",
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : "Sin actividad";

export function ReportsPage({ organizationId, organizationName, role, adapter }: ReportsPageProps) {
  const [view, setView] = useState<ReportView>("patients");
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const reports = useReports(organizationId, filters, adapter);
  const hasResults = Boolean(reports.data && (
    reports.data.patientRows.length || reports.data.screeningRows.length || reports.data.operationMetrics.length
  ));
  const reportStatus = useMemo(() => {
    if (reports.loading) return "Actualizando reporte...";
    if (reports.data) return `Generado ${formatDate(reports.data.generatedAt)}.`;
    return "Listo para consultar.";
  }, [reports.data, reports.loading]);

  if (!can(role, "reports:generate")) {
    return (
      <section className="reports-page" aria-labelledby="reports-title">
        <ReportsHeader organizationName={organizationName} />
        <div className="reports-state reports-state-restricted" role="alert">
          <AlertCircle aria-hidden="true" size={22} />
          <div><strong>Reportes restringidos</strong><p>Su rol puede consultar el flujo clínico, pero no generar reportes profesionales.</p></div>
        </div>
      </section>
    );
  }

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultReportFilters);
  }

  function printReport() {
    globalThis.print();
  }

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <ReportsHeader organizationName={organizationName} />

      <aside className="reports-disclaimer" role="note">
        <FileText aria-hidden="true" size={20} />
        <div><strong>Reporte profesional no diagnóstico</strong><p>Resume actividad, estados operativos y registros de revisión manual. No constituye diagnóstico médico automatizado, no sustituye al oftalmólogo y la IA no está activa en esta beta.</p></div>
      </aside>

      <section className="reports-controls" aria-label="Controles del reporte">
        <div className="reports-controls-heading"><div><p className="eyebrow">Consulta de reportes</p><h2>Filtrar y revisar</h2></div><span className="reports-status" role="status" aria-live="polite">{reportStatus}</span></div>
        <fieldset disabled={reports.loading || reports.notConfigured}>
          <legend className="sr-only">Filtros del reporte</legend>
          <label className="report-search-field">
            Buscar paciente o expediente
            <span><Search aria-hidden="true" size={17} /><input aria-label="Buscar paciente o expediente" onChange={(event) => updateFilter("query", event.target.value)} placeholder="Nombre, código o expediente" value={filters.query} /></span>
          </label>
          <label>Estado<select aria-label="Estado del reporte" onChange={(event) => updateFilter("status", event.target.value as ReportStatusFilter)} value={filters.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Desde<input aria-label="Fecha desde" onChange={(event) => updateFilter("from", event.target.value)} type="date" value={filters.from} /></label>
          <label>Hasta<input aria-label="Fecha hasta" onChange={(event) => updateFilter("to", event.target.value)} type="date" value={filters.to} /></label>
        </fieldset>
        <div className="reports-control-actions"><button className="ghost-button" disabled={reports.loading || reports.notConfigured} onClick={clearFilters} type="button"><Filter aria-hidden="true" size={17} />Limpiar filtros</button><button className="secondary-button" disabled={!hasResults || reports.loading} onClick={printReport} type="button"><Printer aria-hidden="true" size={17} />Imprimir reporte</button></div>
      </section>

      <div className="report-view-tabs" role="tablist" aria-label="Vista del reporte">
        {(Object.keys(viewLabels) as ReportView[]).map((targetView) => <button aria-controls={`report-panel-${targetView}`} aria-selected={view === targetView} className={view === targetView ? "active" : ""} id={`report-tab-${targetView}`} key={targetView} onClick={() => setView(targetView)} role="tab" type="button"><span className="report-tab-icon">{targetView === "patients" ? <UsersRound aria-hidden="true" size={17} /> : targetView === "screenings" ? <FileText aria-hidden="true" size={17} /> : <LayoutDashboard aria-hidden="true" size={17} />}</span>{viewLabels[targetView]}</button>)}
      </div>

      {reports.loading ? <LoadingState label="Cargando reporte" /> : null}
      {reports.error ? <div className="reports-state reports-state-error" role="alert"><AlertCircle aria-hidden="true" size={22} /><div><strong>No pudimos cargar el reporte</strong><p>{reports.error}</p></div><button className="ghost-button" onClick={reports.reload} type="button"><RefreshCw aria-hidden="true" size={17} />Reintentar</button></div> : null}
      {reports.notConfigured ? <div className="reports-state" role="status"><CalendarDays aria-hidden="true" size={22} /><div><strong>Conector de reportes pendiente</strong><p>La experiencia de filtros, vistas, estados e impresión está lista. El adaptador del servicio de reportes de Fase 6 debe conectarse para mostrar datos de la organización.</p></div></div> : null}
      {!reports.loading && !reports.error && !reports.notConfigured && reports.data ? <ReportContent data={reports.data} view={view} /> : null}
      {!reports.loading && !reports.error && !reports.notConfigured && reports.data && !hasResults ? <EmptyState icon={Search} title="Sin datos para este reporte" description="Ajuste los filtros o registre actividad operativa antes de generar una vista imprimible." /> : null}
    </section>
  );
}

function ReportsHeader({ organizationName }: { organizationName: string }) {
  return <header className="reports-heading"><div><p className="eyebrow">Reportes profesionales</p><h1 id="reports-title">Actividad clínica trazable</h1><p>Consulta operativa de {organizationName} para acompañar la revisión profesional y el seguimiento de la atención.</p></div><span className="beta-label">Fase 6 · Beta clínica</span></header>;
}

function ReportContent({ data, view }: { data: NonNullable<ReturnType<typeof useReports>["data"]>; view: ReportView }) {
  if (view === "patients") {
    return <section aria-labelledby="report-panel-patients-heading" className="report-panel" id="report-panel-patients" role="tabpanel" tabIndex={0}><div className="report-panel-heading"><div><p className="eyebrow">Vista por paciente</p><h2 id="report-panel-patients-heading">Pacientes con actividad registrada</h2></div><span>{data.patientRows.length} registros</span></div><div className="report-table-wrap"><table><caption className="sr-only">Actividad de pacientes</caption><thead><tr><th scope="col">Paciente</th><th scope="col">Screenings</th><th scope="col">Última actividad</th><th scope="col">Estado</th><th scope="col">Seguimientos</th></tr></thead><tbody>{data.patientRows.map((row) => <tr key={row.id}><th scope="row"><strong>{row.patientName}</strong><span>{row.identifier}</span></th><td>{row.screenings}</td><td>{formatDate(row.lastActivityAt)}</td><td><span className="report-status-tag">{row.lastStatusLabel}</span></td><td>{row.followUps}</td></tr>)}</tbody></table></div></section>;
  }

  if (view === "screenings") {
    return <ScreeningReportPanel rows={data.screeningRows} />;
  }

  return <section aria-labelledby="report-panel-operations" className="report-panel" id="report-panel-operations" role="tabpanel" tabIndex={0}><div className="report-panel-heading"><div><p className="eyebrow">Vista operativa</p><h2 id="report-panel-operations-heading">Indicadores de trabajo</h2></div><span>{data.operationMetrics.length} indicadores</span></div><div className="operation-metrics">{data.operationMetrics.map((metric) => <article className="operation-metric" key={metric.id}><span className="operation-metric-icon" aria-hidden="true"><LayoutDashboard size={18} /></span><strong>{metric.value}</strong><h3>{metric.label}</h3><p>{metric.detail}</p></article>)}</div></section>;
}

function ScreeningReportPanel({ rows }: { rows: NonNullable<ReturnType<typeof useReports>["data"]>["screeningRows"] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return <section aria-labelledby="report-panel-screenings-heading" className="report-panel" id="report-panel-screenings" role="tabpanel" tabIndex={0}>
    <div className="report-panel-heading"><div><p className="eyebrow">Vista por screening</p><h2 id="report-panel-screenings-heading">Estado de cada screening</h2></div><span>{rows.length} registros</span></div>
    <div className="report-table-wrap"><table><caption className="sr-only">Estado de screenings</caption><thead><tr><th scope="col">Paciente</th><th scope="col">Fecha</th><th scope="col">Estado operativo</th><th scope="col">Calidad</th><th scope="col">Revisión</th><th scope="col">Seguimiento</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row"><strong>{row.patientName}</strong><span>{row.patientIdentifier}</span></th><td>{formatDate(row.createdAt)}</td><td><span className="report-status-tag">{row.statusLabel}</span></td><td>{row.qualityLabel}</td><td>{row.reviewLabel}</td><td>{row.followUpLabel}</td><td><button className="table-link-button" aria-pressed={selectedId === row.id} onClick={() => setSelectedId((current) => current === row.id ? null : row.id)} type="button">{selectedId === row.id ? "Ocultar" : "Ver detalle"}</button></td></tr>)}</tbody></table></div>
    {selected ? <article className="screening-detail-card" aria-labelledby="screening-detail-title"><div><p className="eyebrow">Detalle operativo</p><h3 id="screening-detail-title">{selected.patientName} · {formatDate(selected.createdAt)}</h3></div><dl><div><dt>OD</dt><dd>{selected.odAvailable === undefined ? "No informado" : selected.odAvailable ? "Disponible" : "No disponible"}</dd></div><div><dt>OI</dt><dd>{selected.oiAvailable === undefined ? "No informado" : selected.oiAvailable ? "Disponible" : "No disponible"}</dd></div><div><dt>Calidad</dt><dd>{selected.qualityLabel}</dd></div><div><dt>Revisión profesional</dt><dd>{selected.reviewLabel}</dd></div><div><dt>Seguimiento</dt><dd>{selected.followUpLabel}</dd></div><div><dt>Referencia</dt><dd>{selected.referenceLabel ?? "No informada"}</dd></div></dl></article> : <p className="report-detail-hint">Seleccione un screening para revisar sus datos operativos de OD/OI, calidad, revisión, seguimiento y referencia.</p>}
  </section>;
}
