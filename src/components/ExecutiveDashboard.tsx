import { Activity, CalendarDays, CalendarClock, CheckCircle2, ClipboardList, ListChecks, Search, Stethoscope, UserRoundPlus, UsersRound } from "lucide-react";
import type { DashboardData, DashboardStatus } from "../domain/dashboard";
import { useDashboard } from "../hooks/useDashboard";
import { EmptyState, ErrorNotice, LoadingState } from "./ui";
import type { WorkspaceDestination } from "./OperationalHome";

interface Props { organizationId: string; organizationName: string; onNavigate: (destination: WorkspaceDestination) => void; }
const formatDateTime = (value: string) => new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function StatusChart({ data }: { data: DashboardStatus[] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  let offset = 0;
  const parts = data.map((item, index) => { const start = offset; offset += total ? item.total / total * 100 : 0; return `${index % 2 ? "#5ca89f" : index % 3 ? "#9ed4cd" : "#087a70"} ${start}% ${offset}%`; });
  return <div className="status-chart"><div className="donut" role="img" aria-label={`Distribución por estado: ${data.map((item) => `${item.label}, ${item.total}`).join("; ")}`} style={{ background: total ? `conic-gradient(${parts.join(",")})` : "#e8f1ef" }}><span><strong>{total}</strong>Total</span></div><ul className="chart-legend">{data.map((item) => <li key={item.status}><span aria-hidden="true" /><span>{item.label}</span><strong>{item.total}</strong></li>)}</ul></div>;
}

function AppointmentCalendar({ appointments = [] }: { appointments?: DashboardData["appointments"] }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    const date = day > 0 && day <= daysInMonth ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
    return { day, date, appointments: date ? appointments.filter((item) => item.date === date) : [] };
  });
  const monthLabel = new Intl.DateTimeFormat("es-NI", { month: "long", year: "numeric" }).format(today);
  return <article className="dashboard-card appointment-calendar" aria-labelledby="calendar-title">
    <header><div><p className="eyebrow">Agenda</p><h2 id="calendar-title">Citas de pacientes</h2><h2 className="sr-only">Screenings por mes</h2></div><CalendarDays aria-hidden="true" size={21} /></header>
    <p className="calendar-month">{monthLabel}</p>
    <div className="calendar-weekdays">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{cells.map((cell, index) => <div className={!cell.date ? "calendar-cell muted" : cell.date === today.toISOString().slice(0, 10) ? "calendar-cell today" : "calendar-cell"} key={`${cell.date ?? "empty"}-${index}`}><strong>{cell.date ? cell.day : ""}</strong>{cell.appointments.slice(0, 3).map((item) => <span className="calendar-dot" title={item.title} key={item.id} />)}</div>)}</div>
    <div className="calendar-appointments">{appointments.slice(0, 3).map((item) => <div key={item.id}><time dateTime={item.date}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date(`${item.date}T12:00:00`))}</time><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}{appointments.length === 0 ? <p className="calendar-empty">No hay citas programadas todavía.</p> : null}</div>
  </article>;
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
    <div className="dashboard-chart-grid"><AppointmentCalendar appointments={data.appointments} /><article className="dashboard-card"><header><div><p className="eyebrow">Carga operativa</p><h2>Distribución por estado</h2></div></header>{data.statusDistribution.length ? <StatusChart data={data.statusDistribution} /> : <EmptyState icon={ClipboardList} title="No existen screenings registrados" description="La distribución aparecerá cuando se registre el primer screening." />}</article></div>
    <div className="dashboard-lower-grid"><article className="dashboard-card"><header><div><p className="eyebrow">Timeline</p><h2>Actividad reciente</h2></div></header>{data.recentActivity.length ? <ol className="activity-timeline">{data.recentActivity.map((item) => <li key={item.id}><span aria-hidden="true" /><div><strong>{item.title}</strong><time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time></div></li>)}</ol> : <EmptyState icon={Activity} title="Sin actividad reciente" description="Los eventos clínicos aparecerán aquí al registrarse en el Timeline." />}</article>
    <article className="dashboard-card"><header><div><p className="eyebrow">Prioridades</p><h2>Agenda de Hoy</h2></div></header>{data.agenda.length ? <ol className="agenda-list">{data.agenda.map((item) => <li key={item.id}><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit" }).format(new Date(item.occurredAt))}</time><div><strong>{item.title}</strong><span>{item.detail}</span></div>{item.priority === "high" ? <em>Prioridad</em> : null}</li>)}</ol> : <EmptyState icon={CalendarClock} title="Agenda al día" description="No hay seguimientos o revisiones programadas para hoy." />}</article></div>
    <section className="dashboard-actions" aria-labelledby="actions-title"><div><p className="eyebrow">Acciones rápidas</p><h2 id="actions-title">Continuar el trabajo</h2></div><div><button className="primary-button" onClick={() => onNavigate("patients")} type="button"><UserRoundPlus aria-hidden="true" size={18} />Nuevo Paciente</button><button className="secondary-button" onClick={() => onNavigate("screenings")} type="button"><Stethoscope aria-hidden="true" size={18} />Nuevo Screening</button><button className="secondary-button" onClick={() => onNavigate("patients")} type="button"><Search aria-hidden="true" size={18} />Buscar Paciente</button></div></section>
    <aside className="demo-guide" aria-labelledby="demo-guide-title"><div><span className="summary-icon"><ListChecks aria-hidden="true" size={21} /></span><div><p className="eyebrow">Modo Demo</p><h2 id="demo-guide-title">Recorrido sugerido</h2><p>Guía breve para presentar el flujo sin alterar información clínica.</p></div></div><ol><li><span>1</span>Abra a Mariana López</li><li><span>2</span>Revise OD y OI</li><li><span>3</span>Registre calidad</li><li><span>4</span>Complete workflow</li><li><span>5</span>Vuelva al Dashboard</li></ol><div><button className="secondary-button" onClick={() => onNavigate("patients")} type="button"><Search aria-hidden="true" size={17} />Abrir pacientes demo</button><button className="ghost-button" onClick={() => onNavigate("workflow")} type="button"><Stethoscope aria-hidden="true" size={17} />Ir al workflow</button></div></aside>
  </section>;
}
