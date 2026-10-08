import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bell, Building2, ClipboardList, FileText, Home, LogOut, Menu, Search, Settings, Stethoscope, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { roleLabels } from "../domain/roles";
import { useOrganizationContext } from "../hooks/useOrganizationContext";
import logoUrl from "../../assets/retinacare.jpeg";
import { OperationalHome, type WorkspaceDestination } from "./OperationalHome";
import { EmptyState, ErrorNotice, LoadingState, ToastViewport } from "./ui";
import { can } from "../domain/permissions";
import { supabase } from "../lib/supabase";
import { createReportsAdapter } from "../services/reportsAdapter";
import { OrganizationService } from "../services/organizationService";
import { clinicThemes, paletteFromLogo, type ClinicPalette } from "../domain/clinicBranding";
import { ClinicSettings } from "./ClinicSettings";

const PatientManagement = lazy(() => import("./PatientManagement").then((module) => ({ default: module.PatientManagement })));
const ReportsPage = lazy(() => import("./ReportsPage").then((module) => ({ default: module.ReportsPage })));

interface ClinicWorkspaceProps { user: User; onSignOut: () => Promise<void>; }

const navigation = [
  { id: "home" as const, label: "Inicio", icon: Home },
  { id: "patients" as const, label: "Pacientes", icon: UsersRound },
  { id: "screenings" as const, label: "Screenings", icon: Stethoscope },
  { id: "workflow" as const, label: "Workflow Clínico", icon: ClipboardList },
  { id: "reports" as const, label: "Reportes", icon: FileText, permission: "reports:generate" as const },
  { id: "settings" as const, label: "Configuración", icon: Settings, permission: "organization:manage" as const },
];

export function ClinicWorkspace({ user, onSignOut }: ClinicWorkspaceProps) {
  const { activeOrganization, error, loading, organizations, selectOrganization, registerClinic, saveBranding, logoRevision } = useOrganizationContext(user);
  const [clinicLogoUrl, setClinicLogoUrl] = useState<string | null>(null);
  const [logoPalette, setLogoPalette] = useState<ClinicPalette | null>(null);
  const palette = activeOrganization?.organization.brandTheme === "logo" && logoPalette
    ? logoPalette
    : clinicThemes.retina;
  const themeStyle = {
    "--rc-primary": palette.primary, "--rc-primary-dark": palette.dark,
    "--rc-primary-soft": palette.soft, "--rc-sidebar-bg": palette.sidebar,
    "--rc-accent": palette.accent,
  } as CSSProperties;
  const reportRole = activeOrganization?.role;
  const reportsAdapter = useMemo(
    () => reportRole && supabase ? createReportsAdapter(supabase, reportRole, user.id) : undefined,
    [reportRole, user.id],
  );
  const [activePage, setActivePage] = useState<WorkspaceDestination>("home");
  const [radialOpen, setRadialOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const allowedNavigation = navigation.filter((item) => !item.permission || (activeOrganization && can(activeOrganization.role, item.permission)));
  useEffect(() => {
    if (!radialOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setRadialOpen(false); };
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => globalThis.removeEventListener("keydown", closeOnEscape);
  }, [radialOpen]);
  useEffect(() => {
    setActivePage((page) => page === "settings" && activeOrganization?.role === "clinic_admin" ? "settings" : "home");
  }, [activeOrganization?.organization.id, activeOrganization?.role]);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const path = activeOrganization?.organization.logoPath;
    setClinicLogoUrl(null);
    setLogoPalette(null);
    if (path && supabase) {
      new OrganizationService(supabase).downloadLogo(path)
        .then(async (blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setClinicLogoUrl(objectUrl);
          try {
            const derived = await paletteFromLogo(blob);
            if (!cancelled) setLogoPalette(derived);
          } catch {
            if (!cancelled) setLogoPalette(null);
          }
        })
        .catch(() => { if (!cancelled) setClinicLogoUrl(null); });
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [activeOrganization?.organization.logoPath, logoRevision]);
  const navigate = (page: WorkspaceDestination) => { setActivePage(page); setRadialOpen(false); };
  return (
    <div className="clinical-app-shell radial-workspace" style={themeStyle}>
      <ToastViewport />
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      {radialOpen ? <button className="radial-scrim" aria-label="Cerrar menú radial" onClick={() => setRadialOpen(false)} type="button" /> : null}
      <aside className={radialOpen ? "radial-sidebar open" : "radial-sidebar"} aria-hidden={!radialOpen} aria-label="Menú de RetinaCare" id="radial-navigation">
        <div className="radial-sidebar-shape" aria-hidden="true" />
        <div className="radial-clinic-logo">{clinicLogoUrl ? <img src={clinicLogoUrl} alt={`Logo de ${activeOrganization?.organization.name ?? "la clínica"}`} /> : <Building2 aria-hidden="true" size={68} />}</div>
        <div className="radial-clinic-name">{activeOrganization?.organization.name ?? "Clínica"}</div>
        <div className="radial-quick-actions" aria-label="Accesos rápidos">{allowedNavigation.slice(0, 3).map(({ id, label, icon: Icon }, index) => <button aria-label={`Acceso rápido: ${label}`} className="radial-quick-action" key={id} onClick={() => navigate(id)} style={{ "--radial-index": index } as CSSProperties} tabIndex={radialOpen ? 0 : -1} title={label} type="button"><Icon aria-hidden="true" size={23} /></button>)}</div>
        <nav aria-label="Navegación principal">{allowedNavigation.map(({ id, label, icon: Icon }, index) => <button aria-current={activePage === id ? "page" : undefined} className={activePage === id ? "radial-nav-item active" : "radial-nav-item"} key={id} onClick={() => navigate(id)} style={{ "--radial-index": index } as CSSProperties} tabIndex={radialOpen ? 0 : -1} type="button"><Icon aria-hidden="true" size={18} /><span>{label}</span></button>)}</nav>
      </aside>
      <button className="radial-menu-toggle" aria-controls="radial-navigation" aria-expanded={radialOpen} aria-label={radialOpen ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setRadialOpen((current) => !current)} type="button">{radialOpen ? <X aria-hidden="true" size={24} /> : <Menu aria-hidden="true" size={24} />}</button>

      <div className="app-main-column">
        <header className="workspace-topbar">
          <button className="menu-button" aria-label="Abrir menú desde la barra superior" onClick={() => setRadialOpen(true)} type="button"><Menu size={22} /></button>
          <img className="topbar-logo" src={logoUrl} alt="RetinaCare" /><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients"); }} role="search"><Search aria-hidden="true" size={17} /><label className="sr-only" htmlFor="global-search">Buscar en RetinaCare</label><input id="global-search" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar paciente..." value={globalSearch} /></form><time className="topbar-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date())}</time><div className="notification-wrap"><button className="notification-button" aria-expanded={notificationsOpen} aria-label="Notificaciones" onClick={() => setNotificationsOpen((current) => !current)} type="button"><Bell aria-hidden="true" size={19} /></button>{notificationsOpen ? <div className="notification-popover" role="status"><strong>Notificaciones</strong><span>No hay notificaciones nuevas en esta beta.</span></div> : null}</div>
          <div className="user-menu"><span className="user-avatar" aria-hidden="true">{(user.email?.[0] ?? "U").toUpperCase()}</span><div><strong>{user.email ?? "Usuario RetinaCare"}</strong><span>{activeOrganization ? roleLabels[activeOrganization.role] : "Rol no disponible"}</span></div><button className="logout-button" onClick={() => void onSignOut()} type="button"><LogOut aria-hidden="true" size={18} /><span>Cerrar sesión</span></button></div>
        </header>

        <main className="workspace-content" id="main-content" tabIndex={-1}>
          {loading ? <LoadingState label="Cargando organización" /> : null}
          {error ? <ErrorNotice message="No se pudo cargar el contexto de la clínica. Verifique su conexión e intente nuevamente." /> : null}
          {!loading && !error && !activeOrganization ? <EmptyState icon={Building2} title="Sin organización activa" description="Su usuario necesita una membresía clínica activa para continuar." /> : null}
          {activeOrganization && organizations.length > 1 ? <label className="organization-selector compact-selector">Cambiar organización<select onChange={(event) => selectOrganization(event.target.value)} value={activeOrganization.organization.id}>{organizations.map((context) => <option key={context.organization.id} value={context.organization.id}>{context.organization.name} · {roleLabels[context.role]}</option>)}</select></label> : null}
          {activeOrganization && activePage === "home" ? <OperationalHome organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} onNavigate={navigate} /> : null}
          {activeOrganization && ["patients", "screenings", "workflow"].includes(activePage) ? <Suspense fallback={<LoadingState label="Cargando módulo clínico" />}><PatientManagement initialFocus={activePage as "patients" | "screenings" | "workflow"} initialQuery={globalSearch} organizationId={activeOrganization.organization.id} role={activeOrganization.role} user={user} /></Suspense> : null}
          {activeOrganization && activePage === "reports" ? <Suspense fallback={<LoadingState label="Cargando reportes" />}><ReportsPage adapter={reportsAdapter} organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} /></Suspense> : null}
          {activeOrganization && activePage === "settings" && can(activeOrganization.role, "organization:manage") ? <ClinicSettings context={activeOrganization} savedLogoPalette={logoPalette} userEmail={user.email ?? "Usuario RetinaCare"} onRegisterClinic={registerClinic} onSaveBranding={saveBranding} /> : null}
        </main>
      </div>
    </div>
  );
}
