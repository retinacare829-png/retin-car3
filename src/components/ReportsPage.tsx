import { AlertCircle, ArrowUpRight, Building2, CalendarDays, FileText, Filter, LayoutDashboard, Printer, RefreshCw, Search, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const viewDescriptions: Record<ReportView, string> = {
  patients: "Agrupa la actividad por paciente para ubicar rápidamente expedientes con movimiento reciente.",
  screenings: "Muestra cada visita, su calidad, revisión y seguimiento operativo.",
  operations: "Resume el volumen de trabajo por fechas; no interpreta imágenes ni emite diagnósticos.",
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
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [view, setView] = useState<ReportView>("patients");
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const reports = useReports(organizationId, filters, adapter);
  const visibleResults = view === "patients" ? reports.data?.patientRows.length
    : view === "screenings" ? reports.data?.screeningRows.length : reports.data?.operationMetrics.length;
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
        <div className="reports-controls-heading"><div><p className="eyebrow">Consulta de reportes</p><h2>Filtrar y revisar</h2></div><span className="reports-status" role="status" aria-live="polite"><span aria-hidden="true" />{reportStatus}</span></div>
        <fieldset disabled={reports.loading || reports.notConfigured}>
          <legend className="sr-only">Filtros del reporte</legend>
          <label className="report-search-field">
            Buscar paciente o expediente
            <span><Search aria-hidden="true" size={17} /><input aria-label="Buscar paciente o expediente" disabled={view === "operations"} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Nombre, código o expediente" value={filters.query} /></span>
          </label>
          <label>Estado<select aria-label="Estado del reporte" disabled={view === "operations"} onChange={(event) => updateFilter("status", event.target.value as ReportStatusFilter)} value={filters.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Desde<input aria-label="Fecha desde" onChange={(event) => updateFilter("from", event.target.value)} type="date" value={filters.from} /></label>
          <label>Hasta<input aria-label="Fecha hasta" onChange={(event) => updateFilter("to", event.target.value)} type="date" value={filters.to} /></label>
        </fieldset>
        {view === "operations" ? <p>Los indicadores operativos se filtran por fechas.</p> : null}
        <div className="reports-control-actions"><button className="ghost-button" disabled={reports.loading || reports.notConfigured} onClick={clearFilters} type="button"><Filter aria-hidden="true" size={17} />Limpiar filtros</button><button className="secondary-button" disabled={!visibleResults || reports.loading} onClick={printReport} type="button"><Printer aria-hidden="true" size={17} />Imprimir reporte</button></div>
      </section>

      <div className="report-results-toolbar">
        <div className="report-view-tabs" role="tablist" aria-label="Vista del reporte">
          {(Object.keys(viewLabels) as ReportView[]).map((targetView, index, views) => <button aria-controls={`report-panel-${targetView}`} aria-selected={view === targetView} className={view === targetView ? "active" : ""} id={`report-tab-${targetView}`} key={targetView} onClick={() => setView(targetView)} onKeyDown={(event) => {
            const nextIndex = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
            if (nextIndex === null) return;
            const nextView = views[nextIndex];
            if (!nextView) return;
            event.preventDefault();
            setView(nextView);
            document.getElementById(`report-tab-${nextView}`)?.focus();
          }} role="tab" tabIndex={view === targetView ? 0 : -1} type="button"><span className="report-tab-icon">{targetView === "patients" ? <UsersRound aria-hidden="true" size={17} /> : targetView === "screenings" ? <FileText aria-hidden="true" size={17} /> : <LayoutDashboard aria-hidden="true" size={17} />}</span>{viewLabels[targetView]}</button>)}
        </div>
        <span className="report-result-count">{reports.loading ? "Consultando…" : `${visibleResults ?? 0} ${view === "operations" ? "indicadores" : "registros"}`}</span>
      </div>
      <p className="report-tab-help" role="note"><strong>{viewLabels[view]}:</strong> {viewDescriptions[view]}</p>
      <p className="report-print-context">{viewLabels[view]} · {reportStatus} · Desde: {filters.from || (view === "operations" ? "2000-01-01" : "Sin límite")} · Hasta: {filters.to || (view === "operations" ? todayKey : "Sin límite")}{view !== "operations" ? ` · Estado: ${statusLabels[filters.status]} · Búsqueda: ${filters.query || "Todos los pacientes"}` : ""}</p>

     {reports.loading ? <LoadingState label="Cargando reporte" /> : null}
      {reports.error ? <div className="reports-state reports-state-error" role="alert"><AlertCircle aria-hidden="true" size={22} /><div><strong>No pudimos cargar el reporte</strong><p>{reports.error}</p></div><button className="ghost-button" onClick={reports.reload} type="button"><RefreshCw aria-hidden="true" size={17} />Reintentar</button></div> : null}
      {reports.notConfigured ? <div className="reports-state" role="status"><CalendarDays aria-hidden="true" size={22} /><div><strong>Conector de reportes pendiente</strong><p>La experiencia de filtros, vistas, estados e impresión está lista. El adaptador del servicio de reportes de Fase 6 debe conectarse para mostrar datos de la organización.</p></div></div> : null}
      {!reports.loading && !reports.error && !reports.notConfigured && reports.data ? <ReportContent data={reports.data} view={view} /> : null}
      {!reports.loading && !reports.error && !reports.notConfigured && reports.data && !visibleResults ? <EmptyState icon={Search} title="Sin datos para este reporte" description="Ajuste los filtros o registre actividad operativa antes de generar una vista imprimible." /> : null}
    </section>
  );
}

function ReportsHeader({ organizationName }: { organizationName: string }) {
  return <header className="reports-heading">
    <div>
      <img className="report-print-logo" src="/brand/logo.svg" alt="RetinaCare" />
      <p className="eyebrow">Reportes profesionales</p>
      <h1 id="reports-title">Actividad clínica trazable</h1>
      <p>Consulta operativa de {organizationName} para acompañar la revisión profesional y el seguimiento de la atención.</p>
    </div>
    <div className="reports-heading-meta"><span className="reports-organization"><Building2 size={16} aria-hidden="true" />{organizationName}</span><span className="reports-beta-label">Beta clínica</span></div>
  </header>;
}

function ReportContent({ data, view }: { data: NonNullable<ReturnType<typeof useReports>["data"]>; view: ReportView }) {
  if (view === "patients") {
    return <section aria-labelledby="report-tab-patients" className="report-panel" id="report-panel-patients" role="tabpanel" tabIndex={0}><div className="report-panel-heading"><div><p className="eyebrow">Vista por paciente</p><h2 id="report-panel-patients-heading">Pacientes con actividad registrada</h2></div><span>{data.patientRows.length} registros</span></div><div className="report-table-wrap" role="region" aria-label="Tabla de actividad de pacientes, desplazable horizontalmente" tabIndex={0}><table><caption className="sr-only">Actividad de pacientes</caption><thead><tr><th scope="col">Paciente</th><th scope="col">Screenings</th><th scope="col">Última actividad</th><th scope="col">Estado</th><th scope="col">Seguimientos</th></tr></thead><tbody>{data.patientRows.map((row) => <tr key={row.id}><th scope="row"><strong>{row.patientName}</strong><span>{row.identifier}</span></th><td data-label="Screenings" className="report-number">{row.screenings}</td><td data-label="Última actividad">{formatDate(row.lastActivityAt)}</td><td data-label="Estado"><span className="report-status-tag">{row.lastStatusLabel}</span></td><td data-label="Seguimientos" className="report-number">{row.followUps}</td></tr>)}</tbody></table></div></section>;
  }

  if (view === "screenings") {
    return <ScreeningReportPanel rows={data.screeningRows} />;
  }

  return <section aria-labelledby="report-tab-operations" className="report-panel" id="report-panel-operations" role="tabpanel" tabIndex={0}><div className="report-panel-heading"><div><p className="eyebrow">Vista operativa</p><h2 id="report-panel-operations-heading">Indicadores de trabajo</h2></div><span>{data.operationMetrics.length} indicadores</span></div><div className="operation-metrics">{data.operationMetrics.map((metric) => <article className="operation-metric" key={metric.id}><span className="operation-metric-icon" aria-hidden="true"><LayoutDashboard size={18} /></span><strong>{metric.value}</strong><h3>{metric.label}</h3><p>{metric.detail}</p></article>)}</div></section>;
}

function ScreeningReportPanel({ rows }: { rows: NonNullable<ReturnType<typeof useReports>["data"]>["screeningRows"] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selectedId) detailTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    else detailTrigger.current?.focus();
  }, [selectedId]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return <section aria-labelledby="report-tab-screenings" className="report-panel" id="report-panel-screenings" role="tabpanel" tabIndex={0}>
    <div className="report-panel-heading"><div><p className="eyebrow">Vista por screening</p><h2 id="report-panel-screenings-heading">Estado de cada screening</h2></div><span>{rows.length} registros</span></div>
    <div className="report-table-wrap" role="region" aria-label="Tabla de screenings, desplazable horizontalmente" tabIndex={0}><table><caption className="sr-only">Estado de screenings</caption><thead><tr><th scope="col">Paciente</th><th scope="col">Fecha</th><th scope="col">Estado operativo</th><th scope="col">Calidad</th><th scope="col">Revisión</th><th scope="col">Seguimiento</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead><tbody>{rows.map((row) => <tr className={selectedId === row.id ? "is-selected" : undefined} key={row.id}><th scope="row"><strong>{row.patientName}</strong><span>{row.patientIdentifier}</span></th><td data-label="Fecha">{formatDate(row.createdAt)}</td><td data-label="Estado operativo"><span className="report-status-tag">{row.statusLabel}</span></td><td data-label="Calidad">{row.qualityLabel}</td><td data-label="Revisión">{row.reviewLabel}</td><td data-label="Seguimiento">{row.followUpLabel}</td><td data-label="Acción"><button className="table-link-button" aria-controls={selectedId === row.id ? "screening-report-detail" : undefined} aria-expanded={selectedId === row.id} aria-pressed={selectedId === row.id} onClick={() => setSelectedId((current) => current === row.id ? null : row.id)} type="button">{selectedId === row.id ? "Ocultar" : "Ver detalle"}<ArrowUpRight size={15} aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
    {selected ? <article className="screening-detail-card" id="screening-report-detail" aria-labelledby="screening-detail-title"><div className="screening-detail-heading"><div><p className="eyebrow">Detalle operativo</p><h3 id="screening-detail-title">{selected.patientName} · {formatDate(selected.createdAt)}</h3></div><button className="icon-button" aria-label="Cerrar detalle del screening" type="button" onClick={() => setSelectedId(null)}><X size={18} aria-hidden="true" /></button></div><dl><div><dt>OD</dt><dd>{selected.odAvailable === undefined ? "No informado" : selected.odAvailable ? "Disponible" : "No disponible"}</dd></div><div><dt>OI</dt><dd>{selected.oiAvailable === undefined ? "No informado" : selected.oiAvailable ? "Disponible" : "No disponible"}</dd></div><div><dt>Calidad</dt><dd>{selected.qualityLabel}</dd></div><div><dt>Revisión profesional</dt><dd>{selected.reviewLabel}</dd></div><div><dt>Seguimiento</dt><dd>{selected.followUpLabel}</dd></div><div><dt>Referencia</dt><dd>{selected.referenceLabel ?? "No informada"}</dd></div></dl></article> : <p className="report-detail-hint">Seleccione un screening para revisar sus datos operativos de OD/OI, calidad, revisión, seguimiento y referencia.</p>}
  </section>;
}
