import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bell, Building2, CircleHelp, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { roleLabels } from "../domain/roles";
import { useOrganizationContext } from "../hooks/useOrganizationContext";
import { BrandIcon } from "./BrandIcon";
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
  { id: "home" as const, label: "Inicio", description: "Resumen de la clínica y accesos a las tareas más frecuentes.", icon: "estadistica" as const },
  { id: "patients" as const, label: "Pacientes", description: "Buscá o registrá pacientes y consultá sus visitas.", icon: "paciente" as const },
  { id: "screenings" as const, label: "Screenings", description: "Creá una nueva visita, cargá imágenes de ambos ojos y revisá su calidad.", icon: "tamizaje" as const },
  { id: "workflow" as const, label: "Workflow Clínico", description: "El profesional revisa las imágenes, deja su decisión y completa el seguimiento.", icon: "historial" as const },
  { id: "reports" as const, label: "Reportes", description: "Consultá e imprimí la actividad de la clínica; no es un diagnóstico de IA.", icon: "reporte" as const, permission: "reports:generate" as const },
  { id: "settings" as const, label: "Configuración", description: "Administrá la identidad visual y los datos de tu clínica.", icon: "ajustes" as const, permission: "organization:manage" as const },
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
  const [wideNavigation, setWideNavigation] = useState(() => globalThis.matchMedia?.("(min-width: 1100px)").matches ?? false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navigationVisible = wideNavigation || radialOpen;
  const [helpPage, setHelpPage] = useState<WorkspaceDestination | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const allowedNavigation = navigation.filter((item) => !item.permission || (activeOrganization && can(activeOrganization.role, item.permission)));
  useEffect(() => {
    const media = globalThis.matchMedia?.("(min-width: 1100px)");
    if (!media) return;
    const update = () => setWideNavigation(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!radialOpen || wideNavigation) return;
    navigationRef.current?.querySelector<HTMLButtonElement>("nav button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setRadialOpen(false); menuRef.current?.focus(); }
      if (event.key === "Tab") {
        const controls = Array.from(navigationRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => globalThis.removeEventListener("keydown", closeOnEscape);
  }, [radialOpen, wideNavigation]);
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
  const navigate = (page: WorkspaceDestination) => {
    setActivePage(page); setRadialOpen(false); setHelpPage(null);
    globalThis.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      main?.focus({ preventScroll: true });
      if (page !== "screenings" && page !== "workflow") main?.scrollIntoView?.({ behavior: "auto", block: "start" });
    });
  };
  return (
    <div className="clinical-app-shell premium-workspace" style={themeStyle}>
      <ToastViewport />
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      {radialOpen && !wideNavigation ? <button className="navigation-scrim" aria-label="Cerrar menú radial" onClick={() => setRadialOpen(false)} type="button" tabIndex={-1} /> : null}
      <aside ref={navigationRef} className={`workspace-sidebar${radialOpen ? " open" : ""}`} aria-hidden={!navigationVisible} aria-label="Menú de RetinaCare" role={radialOpen && !wideNavigation ? "dialog" : undefined} aria-modal={radialOpen && !wideNavigation ? true : undefined} id="workspace-navigation">
        <div className="sidebar-clinic"><div className="sidebar-clinic-logo">{clinicLogoUrl ? <img src={clinicLogoUrl} alt={`Logo de ${activeOrganization?.organization.name ?? "la clínica"}`} /> : <BrandIcon name="institucion" size={32} />}</div><span>Tu clínica</span><strong>{activeOrganization?.organization.name ?? "Retina Care"}</strong></div>
        <p className="sidebar-section-label">Espacio de trabajo</p>
        <nav aria-label="Navegación principal">{allowedNavigation.map(({ id, label, description, icon }) => <div className={`sidebar-nav-entry${activePage === id ? " active" : ""}`} key={id}><button aria-current={activePage === id ? "page" : undefined} className="sidebar-nav-item" onClick={() => navigate(id)} tabIndex={navigationVisible ? 0 : -1} title={description} type="button"><BrandIcon name={icon} size={21} /><span>{label}</span></button><button aria-expanded={helpPage === id} aria-label={`¿Para qué sirve ${label}?`} className="sidebar-nav-help" onClick={() => setHelpPage((current) => current === id ? null : id)} tabIndex={navigationVisible ? 0 : -1} type="button"><CircleHelp aria-hidden="true" size={16} /></button>{helpPage === id ? <p className="sidebar-nav-description" role="status">{description}</p> : null}</div>)}</nav>
        <div className="sidebar-foot"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Entorno de demostración</strong><span>Usá únicamente datos ficticios.</span></div></div>
        {!wideNavigation ? <button className="sidebar-close ghost-button" onClick={() => { setRadialOpen(false); menuRef.current?.focus(); }} type="button" tabIndex={navigationVisible ? 0 : -1}><X size={18} aria-hidden="true" />Cerrar menú</button> : null}
      </aside>

      <div className="app-main-column">
        <header className="workspace-topbar">
          <button ref={menuRef} className="menu-button" aria-controls="workspace-navigation" aria-expanded={radialOpen} aria-label={radialOpen ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setRadialOpen((current) => !current)} type="button">{radialOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}</button>
          <img className="topbar-logo" src="/brand/logo.svg" alt="RetinaCare" /><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients"); }} role="search"><Search aria-hidden="true" size={18} /><label className="sr-only" htmlFor="global-search">Buscar en RetinaCare</label><input id="global-search" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar paciente..." value={globalSearch} /><span className="search-hint">Buscar</span></form><time className="topbar-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date())}</time><div className="notification-wrap"><button className="notification-button" aria-expanded={notificationsOpen} aria-label="Notificaciones" onClick={() => setNotificationsOpen((current) => !current)} type="button"><Bell aria-hidden="true" size={19} /></button>{notificationsOpen ? <div className="notification-popover" role="status"><strong>Notificaciones</strong><span>No hay notificaciones nuevas en esta beta.</span></div> : null}</div>
          <div className="user-menu"><span className="user-avatar" aria-hidden="true">{(user.email?.[0] ?? "U").toUpperCase()}</span><div><strong>{user.email ?? "Usuario RetinaCare"}</strong><span>{activeOrganization ? roleLabels[activeOrganization.role] : "Rol no disponible"}</span></div><button className="logout-button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void onSignOut()} type="button"><LogOut aria-hidden="true" size={18} /><span>Cerrar sesión</span></button></div>
        </header>

        <main className="workspace-content" id="main-content" tabIndex={-1}>
          {loading ? <LoadingState label="Cargando organización" /> : null}
          {error ? <ErrorNotice message="No se pudo cargar el contexto de la clínica. Verifique su conexión e intente nuevamente." /> : null}
          {!loading && !error && !activeOrganization ? <EmptyState icon={Building2} title="Sin organización activa" description="Su usuario necesita una membresía clínica activa para continuar." /> : null}
          {activeOrganization && organizations.length > 1 ? <label className="organization-selector compact-selector">Cambiar organización<select onChange={(event) => selectOrganization(event.target.value)} value={activeOrganization.organization.id}>{organizations.map((context) => <option key={context.organization.id} value={context.organization.id}>{context.organization.name} · {roleLabels[context.role]}</option>)}</select></label> : null}
          {activeOrganization && activePage === "home" ? <OperationalHome organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} onNavigate={navigate} /> : null}
          {activeOrganization && ["patients", "screenings", "workflow"].includes(activePage) ? <Suspense fallback={<LoadingState label="Cargando módulo clínico" />}><PatientManagement initialFocus={activePage as "patients" | "screenings" | "workflow"} initialQuery={globalSearch} organizationId={activeOrganization.organization.id} role={activeOrganization.role} user={user} /></Suspense> : null}
          {activeOrganization && activePage === "reports" ? <Suspense fallback={<LoadingState label="Cargando reportes" />}><ReportsPage adapter={reportsAdapter} organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} /></Suspense> : null}
          {activeOrganization && activePage === "settings" && can(activeOrganization.role, "organization:manage") ? <ClinicSettings context={activeOrganization} savedLogoPalette={logoPalette} savedLogoUrl={clinicLogoUrl} userEmail={user.email ?? "Usuario RetinaCare"} onRegisterClinic={registerClinic} onSaveBranding={saveBranding} /> : null}
        </main>
      </div>
    </div>
  );
}
