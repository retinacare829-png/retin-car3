import { lazy, Suspense, useState } from "react";
import { Bell, Building2, BarChart3, ChevronDown, ClipboardList, FileText, Home, LogOut, Menu, Search, Settings, Stethoscope, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { roleLabels } from "../domain/roles";
import { useOrganizationContext } from "../hooks/useOrganizationContext";
import logoUrl from "../../assets/retinacare.jpeg";
import { OperationalHome, type WorkspaceDestination } from "./OperationalHome";
import { EmptyState, ErrorNotice, LoadingState, ToastViewport } from "./ui";
import { can } from "../domain/permissions";

const PatientManagement = lazy(() => import("./PatientManagement").then((module) => ({ default: module.PatientManagement })));
const ExecutiveDashboard = lazy(() => import("./ExecutiveDashboard").then((module) => ({ default: module.ExecutiveDashboard })));

interface ClinicWorkspaceProps { user: User; onSignOut: () => Promise<void>; }

const navigation = [
  { id: "home" as const, label: "Inicio", icon: Home },
  { id: "patients" as const, label: "Pacientes", icon: UsersRound },
  { id: "screenings" as const, label: "Screenings", icon: Stethoscope },
  { id: "workflow" as const, label: "Workflow Clínico", icon: ClipboardList },
  { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
  { id: "reports" as const, label: "Reportes", icon: FileText, permission: "reports:generate" as const },
  { id: "settings" as const, label: "Configuración", icon: Settings, permission: "organization:manage" as const },
];

const titles: Record<WorkspaceDestination, { title: string; breadcrumb: string }> = {
  home: { title: "Inicio operativo", breadcrumb: "Inicio" },
  patients: { title: "Pacientes", breadcrumb: "Pacientes" },
  screenings: { title: "Screenings", breadcrumb: "Pacientes / Screenings" },
  workflow: { title: "Workflow Clínico", breadcrumb: "Pacientes / Screening / Workflow Clínico" },
  dashboard: { title: "Dashboard", breadcrumb: "Dashboard" }, reports: { title: "Reportes", breadcrumb: "Reportes" },
  settings: { title: "Configuración", breadcrumb: "Configuración" },
};

export function ClinicWorkspace({ user, onSignOut }: ClinicWorkspaceProps) {
  const { activeOrganization, error, loading, organizations, selectOrganization } = useOrganizationContext(user);
  const [activePage, setActivePage] = useState<WorkspaceDestination>("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (page: WorkspaceDestination) => { setActivePage(page); setMobileOpen(false); };
  const current = titles[activePage];

  return (
    <div className="clinical-app-shell">
      <ToastViewport />
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className={mobileOpen ? "app-sidebar open" : "app-sidebar"} aria-label="Barra lateral de RetinaCare">
        <div className="sidebar-brand"><img src={logoUrl} alt="RetinaCare" /><button className="mobile-close" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} type="button"><X size={20} /></button></div>
        <div className="clinic-context"><Building2 aria-hidden="true" size={19} /><div><span>Organización activa</span><strong>{activeOrganization?.organization.name ?? "Sin clínica seleccionada"}</strong></div></div>
        <nav aria-label="Navegación principal">{navigation.filter((item) => !item.permission || (activeOrganization && can(activeOrganization.role, item.permission))).map(({ id, label, icon: Icon }) => <button aria-current={activePage === id ? "page" : undefined} className={activePage === id ? "nav-item active" : "nav-item"} key={id} onClick={() => navigate(id)} type="button"><Icon aria-hidden="true" size={19} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-disclaimer"><strong>Versión beta</strong><span>No realiza diagnóstico automatizado.</span></div>
      </aside>
      {mobileOpen ? <button className="sidebar-scrim" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} type="button" /> : null}

      <div className="app-main-column">
        <header className="workspace-topbar">
          <button className="menu-button" aria-label="Abrir navegación" onClick={() => setMobileOpen(true)} type="button"><Menu size={22} /></button>
          <img className="topbar-logo" src={logoUrl} alt="RetinaCare" /><div className="topbar-page-context"><span>{current.breadcrumb}</span><strong>{current.title}</strong></div><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients"); }} role="search"><Search aria-hidden="true" size={17} /><label className="sr-only" htmlFor="global-search">Buscar en RetinaCare</label><input id="global-search" placeholder="Buscar paciente..." /></form><time className="topbar-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date())}</time><button className="notification-button" aria-label="Notificaciones" type="button"><Bell aria-hidden="true" size={19} /></button>
          <div className="user-menu"><span className="user-avatar" aria-hidden="true">{(user.email?.[0] ?? "U").toUpperCase()}</span><div><strong>{user.email ?? "Usuario RetinaCare"}</strong><span>{activeOrganization ? roleLabels[activeOrganization.role] : "Rol no disponible"}</span></div><ChevronDown aria-hidden="true" size={16} /><button className="logout-button" onClick={() => void onSignOut()} type="button"><LogOut aria-hidden="true" size={18} /><span>Cerrar sesión</span></button></div>
        </header>

        <main className="workspace-content" id="main-content" tabIndex={-1}>
          {loading ? <LoadingState label="Cargando organización" /> : null}
          {error ? <ErrorNotice message="No se pudo cargar el contexto de la clínica. Verifique su conexión e intente nuevamente." /> : null}
          {!loading && !error && !activeOrganization ? <EmptyState icon={Building2} title="Sin organización activa" description="Su usuario necesita una membresía clínica activa para continuar." /> : null}
          {activeOrganization && organizations.length > 1 ? <label className="organization-selector compact-selector">Cambiar organización<select onChange={(event) => selectOrganization(event.target.value)} value={activeOrganization.organization.id}>{organizations.map((context) => <option key={context.organization.id} value={context.organization.id}>{context.organization.name} · {roleLabels[context.role]}</option>)}</select></label> : null}
          {activeOrganization && activePage === "home" ? <OperationalHome organizationName={activeOrganization.organization.name} onNavigate={navigate} /> : null}
          {activeOrganization && activePage === "dashboard" && can(activeOrganization.role, "dashboard:view") ? <Suspense fallback={<LoadingState label="Cargando dashboard" />}><ExecutiveDashboard organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} onNavigate={navigate} /></Suspense> : null}
          {activeOrganization && ["patients", "screenings", "workflow"].includes(activePage) ? <Suspense fallback={<LoadingState label="Cargando módulo clínico" />}><PatientManagement initialFocus={activePage as "patients" | "screenings" | "workflow"} organizationId={activeOrganization.organization.id} role={activeOrganization.role} user={user} /></Suspense> : null}
          {activeOrganization && activePage === "reports" ? <section className="simple-page" aria-labelledby="reports-title"><p className="eyebrow">Próximamente</p><h1 id="reports-title">Reportes</h1><EmptyState icon={FileText} title="Reportes no disponibles" description="La generación de reportes no forma parte de esta fase." /></section> : null}
          {activeOrganization && activePage === "settings" ? <section className="simple-page" aria-labelledby="settings-title"><p className="eyebrow">Alcance beta</p><h1 id="settings-title">Configuración</h1><article className="info-card"><h2>Contexto de sesión</h2><dl className="settings-list"><div><dt>Organización</dt><dd>{activeOrganization.organization.name}</dd></div><div><dt>Usuario</dt><dd>{user.email}</dd></div><div><dt>Rol</dt><dd>{roleLabels[activeOrganization.role]}</dd></div></dl><p className="scope-note">La administración avanzada de usuarios y clínica no forma parte de esta fase.</p></article></section> : null}
        </main>
      </div>
    </div>
  );
}
