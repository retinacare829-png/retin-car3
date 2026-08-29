import { Activity, CalendarClock, CheckCircle2, ClipboardList, ListChecks, Search, Stethoscope, UserRoundPlus, UsersRound } from "lucide-react";
import type { DashboardMonth, DashboardStatus } from "../domain/dashboard";
import { useDashboard } from "../hooks/useDashboard";
import { EmptyState, ErrorNotice, LoadingState } from "./ui";
import type { WorkspaceDestination } from "./OperationalHome";

interface Props { organizationId: string; organizationName: string; onNavigate: (destination: WorkspaceDestination) => void; }
const formatDateTime = (value: string) => new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function MonthlyChart({ data }: { data: DashboardMonth[] }) {
  const max = Math.max(1, ...data.map((item) => item.total));
  return <div className="bar-chart" role="img" aria-label={`Screenings por mes: ${data.map((item) => `${item.label}, ${item.total}`).join("; ")}`}>
    {data.map((item) => <div className="bar-column" key={item.key}><span className="bar-value">{item.total}</span><span className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(item.total ? 10 : 2, item.total / max * 100)}%` }} /></span><span>{item.label}</span></div>)}
  </div>;
}

function StatusChart({ data }: { data: DashboardStatus[] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  let offset = 0;
  const parts = data.map((item, index) => { const start = offset; offset += total ? item.total / total * 100 : 0; return `${index % 2 ? "#5ca89f" : index % 3 ? "#9ed4cd" : "#087a70"} ${start}% ${offset}%`; });
  return <div className="status-chart"><div className="donut" role="img" aria-label={`Distribución por estado: ${data.map((item) => `${item.label}, ${item.total}`).join("; ")}`} style={{ background: total ? `conic-gradient(${parts.join(",")})` : "#e8f1ef" }}><span><strong>{total}</strong>Total</span></div><ul className="chart-legend">{data.map((item) => <li key={item.status}><span aria-hidden="true" /><span>{item.label}</span><strong>{item.total}</strong></li>)}</ul></div>;
}

export function ExecutiveDashboard({ organizationId, organizationName, onNavigate }: Props) {
  const { data, error, loading } = useDashboard(organizationId);
  const hour = new Date().getHours(); const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  if (loading) return <LoadingState label="Cargando dashboard" />;
  if (error) return <ErrorNotice message="No fue posible consultar los indicadores. Verifique su conexión e intente nuevamente." />;
  const kpis = [
    { label: "Total Pacientes", value: data.totals.patients, detail: "Pacientes activos", icon: UsersRound },
    { label: "Total Screenings", value: data.totals.screenings, detail: "Screenings registrados", icon: Stethoscope },
    { label: "Pendientes", value: data.totals.pending, detail: "Requieren continuidad", icon: ClipboardList },
    { label: "Revisados", value: data.totals.reviewed, detail: "Revisados o cerrados", icon: CheckCircle2 },
    { label: "Seguimientos", value: data.totals.followUps, detail: "Seguimientos activos", icon: CalendarClock },
  ];
  return <section className="executive-dashboard" aria-labelledby="dashboard-title">
    <div className="dashboard-heading"><div><p className="eyebrow">Dashboard ejecutivo y operativo</p><h1 id="dashboard-title">{greeting}.</h1><p>Panorama actualizado de {organizationName}.</p></div><span>{new Intl.DateTimeFormat("es-NI", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span></div>
    <article className="today-summary"><div><span className="summary-icon"><Activity aria-hidden="true" size={22} /></span><div><p className="eyebrow">Resumen del día</p><h2>Hoy tienes:</h2></div></div><ul><li><strong>{data.today.pendingScreenings}</strong><span>Screenings pendientes</span></li><li><strong>{data.today.scheduledFollowUps}</strong><span>Seguimientos programados</span></li><li><strong>{data.today.pendingReviews}</strong><span>Revisiones pendientes</span></li><li><strong>{data.today.newPatients}</strong><span>Nuevos pacientes registrados</span></li></ul></article>
    <div className="kpi-grid">{kpis.map(({ label, value, detail, icon: Icon }) => <article className="kpi-card" key={label}><span><Icon aria-hidden="true" size={20} /></span><strong>{value}</strong><h2>{label}</h2><p>{detail}</p></article>)}</div>
    <div className="dashboard-chart-grid"><article className="dashboard-card"><header><div><p className="eyebrow">Tendencia</p><h2>Screenings por mes</h2></div></header><MonthlyChart data={data.screeningsByMonth} /></article><article className="dashboard-card"><header><div><p className="eyebrow">Carga operativa</p><h2>Distribución por estado</h2></div></header>{data.statusDistribution.length ? <StatusChart data={data.statusDistribution} /> : <EmptyState icon={ClipboardList} title="No existen screenings registrados" description="La distribución aparecerá cuando se registre el primer screening." />}</article></div>
    <div className="dashboard-lower-grid"><article className="dashboard-card"><header><div><p className="eyebrow">Timeline</p><h2>Actividad reciente</h2></div></header>{data.recentActivity.length ? <ol className="activity-timeline">{data.recentActivity.map((item) => <li key={item.id}><span aria-hidden="true" /><div><strong>{item.title}</strong><time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time></div></li>)}</ol> : <EmptyState icon={Activity} title="Sin actividad reciente" description="Los eventos clínicos aparecerán aquí al registrarse en el Timeline." />}</article>
    <article className="dashboard-card"><header><div><p className="eyebrow">Prioridades</p><h2>Agenda de Hoy</h2></div></header>{data.agenda.length ? <ol className="agenda-list">{data.agenda.map((item) => <li key={item.id}><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit" }).format(new Date(item.occurredAt))}</time><div><strong>{item.title}</strong><span>{item.detail}</span></div>{item.priority === "high" ? <em>Prioridad</em> : null}</li>)}</ol> : <EmptyState icon={CalendarClock} title="Agenda al día" description="No hay seguimientos o revisiones programadas para hoy." />}</article></div>
    <section className="dashboard-actions" aria-labelledby="actions-title"><div><p className="eyebrow">Acciones rápidas</p><h2 id="actions-title">Continuar el trabajo</h2></div><div><button className="primary-button" onClick={() => onNavigate("patients")} type="button"><UserRoundPlus aria-hidden="true" size={18} />Nuevo Paciente</button><button className="secondary-button" onClick={() => onNavigate("screenings")} type="button"><Stethoscope aria-hidden="true" size={18} />Nuevo Screening</button><button className="secondary-button" onClick={() => onNavigate("patients")} type="button"><Search aria-hidden="true" size={18} />Buscar Paciente</button></div></section>
    <aside className="demo-guide" aria-labelledby="demo-guide-title"><div><span className="summary-icon"><ListChecks aria-hidden="true" size={21} /></span><div><p className="eyebrow">Modo Demo</p><h2 id="demo-guide-title">Recorrido sugerido</h2><p>Guía breve para presentar el flujo sin alterar información clínica.</p></div></div><ol><li><span>1</span>Abra a Mariana López</li><li><span>2</span>Revise OD y OI</li><li><span>3</span>Registre calidad</li><li><span>4</span>Complete workflow</li><li><span>5</span>Vuelva al Dashboard</li></ol><div><button className="secondary-button" onClick={() => onNavigate("patients")} type="button"><Search aria-hidden="true" size={17} />Abrir pacientes demo</button><button className="ghost-button" onClick={() => onNavigate("workflow")} type="button"><Stethoscope aria-hidden="true" size={17} />Ir al workflow</button></div></aside>
  </section>;
}
