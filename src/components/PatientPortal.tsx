import { useState } from "react";
import { ArrowRight, Building2, CalendarDays, ClipboardList, FileText, Home, Info, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { type PatientPortalAdapter, type PatientPortalReport, type PatientPortalScreening, type PatientPortalSnapshot } from "../domain/patientPortal";
import { usePatientPortal } from "../hooks/usePatientPortal";
import { ErrorNotice, EmptyState, LoadingState, StatusBadge } from "./ui";

type PatientPortalPage = "home" | "screenings" | "reports" | "profile";

interface PatientPortalProps {
  user: User;
  onSignOut: () => Promise<void>;
  adapter?: PatientPortalAdapter;
}

const navigation: Array<{ id: PatientPortalPage; label: string; icon: typeof Home }> = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "screenings", label: "Mis screenings", icon: ClipboardList },
  { id: "reports", label: "Mis informes", icon: FileText },
  { id: "profile", label: "Mis datos", icon: UserRound },
];

export function PatientPortal({ user, onSignOut, adapter }: PatientPortalProps) {
  const { data, error, loading, reload } = usePatientPortal(adapter);
  const [activePage, setActivePage] = useState<PatientPortalPage>("home");
  const displayName = data?.profile.firstNames ?? data?.profile.displayName ?? "Paciente";

  return (
    <div className="patient-portal-shell">
      <a className="skip-link" href="#patient-main-content">Saltar al contenido principal</a>
      <header className="patient-portal-header">
        <div className="patient-portal-brand">
          <img src="/brand/logo.svg" alt="RetinaCare" />
          <span>Portal paciente</span>
        </div>
        <div className="patient-portal-account">
          <div className="patient-portal-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="patient-portal-account-copy"><strong>{displayName}</strong><span>{user.email ?? "Cuenta RetinaCare"}</span></div>
          <button className="patient-portal-signout" aria-label="Cerrar sesión" onClick={() => void onSignOut()} type="button"><LogOut aria-hidden="true" size={17} /><span>Cerrar sesión</span></button>
        </div>
      </header>

      <nav className="patient-portal-nav" aria-label="Navegación del portal paciente">
        {navigation.map(({ id, label, icon: Icon }) => <button aria-current={activePage === id ? "page" : undefined} className={activePage === id ? "patient-nav-item active" : "patient-nav-item"} key={id} onClick={() => setActivePage(id)} type="button"><Icon aria-hidden="true" size={18} /><span>{label}</span></button>)}
      </nav>

      <main className="patient-portal-content" id="patient-main-content" tabIndex={-1}>
        <div className="patient-portal-beta-note" role="note"><Info size={18} aria-hidden="true" /><div><strong>RetinaCare está en beta.</strong><span>Este portal muestra información compartida por tu clínica. No ofrece diagnósticos ni sustituye la orientación de un profesional.</span></div></div>
        {loading ? <LoadingState label="Cargando tu información" /> : null}
        {!loading && error ? <ErrorNotice message={error} onRetry={adapter ? reload : undefined} /> : null}
        {!loading && !error && data ? <>
          {activePage === "home" ? <PatientPortalHome data={data} onNavigate={setActivePage} /> : null}
          {activePage === "screenings" ? <PatientScreenings screenings={data.screenings} /> : null}
          {activePage === "reports" ? <PatientReports reports={data.reports} /> : null}
          {activePage === "profile" ? <PatientProfile data={data} /> : null}
        </> : null}
      </main>
      <footer className="patient-portal-footer"><span><ShieldCheck size={16} aria-hidden="true" />Información compartida por tu clínica</span><span>RetinaCare · Portal del paciente</span></footer>
    </div>
  );
}

function PatientPortalHome({ data, onNavigate }: { data: PatientPortalSnapshot; onNavigate: (page: PatientPortalPage) => void }) {
  const latestScreening = data.screenings[0];
  const latestReport = data.reports[0];
  return <section className="patient-portal-page" aria-labelledby="patient-home-title">
    <div className="patient-portal-heading patient-home-heading"><div><p className="eyebrow">Tu espacio RetinaCare</p><h1 id="patient-home-title">Hola, {data.profile.firstNames}</h1><p>Consulta el avance de tus screenings y los informes que tu clínica haya publicado.</p></div><span className="patient-portal-clinic"><Building2 size={16} aria-hidden="true" />{data.profile.organizationName}</span></div>
    <div className="patient-portal-summary-grid">
      <article className="patient-portal-summary-card"><span className="patient-summary-label"><ClipboardList size={18} aria-hidden="true" />Screenings</span><strong>{data.screenings.length}</strong><small>Registros compartidos</small></article>
      <article className="patient-portal-summary-card accent"><span className="patient-summary-label"><FileText size={18} aria-hidden="true" />Informes publicados</span><strong>{data.reports.length}</strong><small>Disponibles para consultar</small></article>
      <article className="patient-portal-summary-card soft"><span className="patient-summary-label"><CalendarDays size={18} aria-hidden="true" />Último estado</span><strong className="patient-summary-status">{latestScreening?.statusLabel ?? "Sin registros"}</strong><small>{latestScreening ? formatDate(latestScreening.createdAt) : "Aún no hay screenings"}</small></article>
    </div>
    <div className="patient-portal-home-grid">
      <section className="patient-portal-panel" aria-labelledby="patient-latest-screening-title"><div className="patient-portal-panel-heading"><div><p className="eyebrow">Actividad reciente</p><h2 id="patient-latest-screening-title">Último screening</h2></div><button className="patient-portal-link" onClick={() => onNavigate("screenings")} type="button">Ver todos<ArrowRight size={15} aria-hidden="true" /></button></div>{latestScreening ? <ScreeningCard screening={latestScreening} compact /> : <EmptyState title="Todavía no hay screenings compartidos" description="Cuando tu clínica apruebe y comparta una atención, aparecerá aquí." />}</section>
      <section className="patient-portal-panel" aria-labelledby="patient-latest-report-title"><div className="patient-portal-panel-heading"><div><p className="eyebrow">Aprobación profesional</p><h2 id="patient-latest-report-title">Último informe</h2></div><button className="patient-portal-link" onClick={() => onNavigate("reports")} type="button">Ver informes<ArrowRight size={15} aria-hidden="true" /></button></div>{latestReport ? <ReportCard report={latestReport} compact /> : <EmptyState title="Sin informes publicados" description="Tu clínica aún no ha publicado un informe para tu portal." />}</section>
    </div>
  </section>;
}

function PatientScreenings({ screenings }: { screenings: PatientPortalScreening[] }) {
  return <section className="patient-portal-page" aria-labelledby="patient-screenings-title"><div className="patient-portal-heading"><div><p className="eyebrow">Seguimiento administrativo</p><h1 id="patient-screenings-title">Mis screenings</h1><p>Aquí puedes ver el estado básico de las atenciones que tu clínica haya compartido. Este estado no es un diagnóstico.</p></div></div>{screenings.length === 0 ? <EmptyState title="Todavía no hay screenings compartidos" description="Cuando tu clínica apruebe y comparta una atención, aparecerá aquí." /> : <div className="patient-portal-list">{screenings.map((screening) => <ScreeningCard key={screening.id} screening={screening} />)}</div>}</section>;
}

function PatientReports({ reports }: { reports: PatientPortalReport[] }) {
  return <section className="patient-portal-page" aria-labelledby="patient-reports-title"><div className="patient-portal-heading"><div><p className="eyebrow">Información compartida</p><h1 id="patient-reports-title">Mis informes</h1><p>Solo aparecen informes publicados después de la aprobación explícita de un profesional.</p></div></div>{reports.length === 0 ? <EmptyState title="Aún no hay informes publicados" description="Los borradores y resultados pendientes no se muestran en este portal." /> : <div className="patient-portal-list">{reports.map((report) => <ReportCard key={report.id} report={report} />)}</div>}</section>;
}

function PatientProfile({ data }: { data: PatientPortalSnapshot }) {
  return <section className="patient-portal-page" aria-labelledby="patient-profile-title"><div className="patient-portal-heading"><div><p className="eyebrow">Información personal</p><h1 id="patient-profile-title">Mis datos</h1><p>Estos son los datos básicos asociados a tu cuenta en RetinaCare.</p></div></div><dl className="patient-portal-profile-card"><div><dt>Nombre completo</dt><dd>{data.profile.firstNames} {data.profile.lastNames}</dd></div><div><dt>Fecha de nacimiento</dt><dd>{formatDate(data.profile.dateOfBirth)}</dd></div><div><dt>Teléfono</dt><dd>{data.profile.phone ?? "No registrado"}</dd></div><div><dt>Correo electrónico</dt><dd>{data.profile.email ?? "No registrado"}</dd></div></dl><p className="patient-portal-help"><Info size={18} aria-hidden="true" /><span>¿Necesitas corregir un dato? Comunícate con tu clínica para solicitar una actualización.</span></p></section>;
}

function ScreeningCard({ screening, compact = false }: { screening: PatientPortalScreening; compact?: boolean }) {
  return <article className={compact ? "patient-screening-card compact" : "patient-screening-card"}><div className="patient-screening-card-heading"><div><span className="patient-card-label">Expediente</span><strong>{screening.recordCode}</strong></div><StatusBadge label={screening.statusLabel} tone={screening.status === "CERRADO" || screening.status === "REVISADO" ? "complete" : "progress"} /></div><dl className="patient-screening-meta"><div><dt>Fecha</dt><dd>{formatDate(screening.createdAt)}</dd></div><div><dt>Informe profesional</dt><dd>{screening.reportPublished ? "Publicado" : "Aún no publicado"}</dd></div></dl></article>;
}

function ReportCard({ report, compact = false }: { report: PatientPortalReport; compact?: boolean }) {
  const ReportHeading = compact ? "h3" : "h2";
  return <article className={compact ? "patient-report-card compact" : "patient-report-card"}><div className="patient-report-card-heading"><div><span className="patient-card-label">Informe · {report.recordCode}</span><ReportHeading>{report.title}</ReportHeading></div><span className="patient-published-badge"><ShieldCheck size={14} aria-hidden="true" />Publicado</span></div><p>{report.summary}</p><dl className="patient-report-meta"><div><dt>Publicado</dt><dd>{formatDate(report.publishedAt)}</dd></div>{report.nextStep ? <div className="patient-report-next-step"><dt>Próximo paso</dt><dd>{report.nextStep}</dd></div> : null}</dl>{report.publishedBy ? <small className="patient-report-author">Compartido por {report.publishedBy}</small> : null}</article>;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}
