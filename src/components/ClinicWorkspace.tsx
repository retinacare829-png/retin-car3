import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Building2, CircleHelp, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react";
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
import { ClinicNotificationCenter } from "./NotificationCenter";
import "./RadialNavigation.css";

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
  const navigationRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuOpenerRef = useRef<HTMLButtonElement | null>(null);
  const mainColumnRef = useRef<HTMLDivElement>(null);
  const [helpPage, setHelpPage] = useState<WorkspaceDestination | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const allowedNavigation = navigation.filter((item) => !item.permission || (activeOrganization && can(activeOrganization.role, item.permission)));
  function closeNavigation() {
    setRadialOpen(false);
    setHelpPage(null);
  }
  useEffect(() => {
    if (!radialOpen) return;
    const main = mainColumnRef.current;
    const previousOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    const currentRoute = navigationRef.current?.querySelector<HTMLButtonElement>('nav button[aria-current="page"]');
    (currentRoute ?? navigationRef.current?.querySelector<HTMLButtonElement>("nav button"))?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setRadialOpen(false); setHelpPage(null); }
      if (event.key === "Tab") {
        const controls = [...Array.from(navigationRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []), menuRef.current].filter((control): control is HTMLButtonElement => Boolean(control));
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => {
      globalThis.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      if (main) main.inert = false;
      menuOpenerRef.current?.focus();
    };
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
  const navigate = (page: WorkspaceDestination) => {
    setActivePage(page); setRadialOpen(false); setHelpPage(null);
    globalThis.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      main?.focus({ preventScroll: true });
      if (page !== "screenings" && page !== "workflow") main?.scrollIntoView?.({ behavior: "auto", block: "start" });
    });
  };
  return (
    <div className="clinical-app-shell premium-workspace radial-workspace" style={themeStyle}>
      <ToastViewport />
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      {radialOpen ? <button className="radial-scrim" aria-label="Cerrar menú radial" onClick={closeNavigation} type="button" tabIndex={-1} /> : null}
      <div className="radial-navigation-layer" role={radialOpen ? "dialog" : undefined} aria-modal={radialOpen ? true : undefined} aria-label={radialOpen ? "Menú de RetinaCare" : undefined}>
        <aside ref={navigationRef} className="radial-sidebar" hidden={!radialOpen} id="workspace-navigation">
          <div className="radial-stage">
            <div className="radial-sidebar-shape" aria-hidden="true" />
            <p className="radial-section-label">Espacio de trabajo</p>
            <div className="radial-clinic">
              <div className="radial-clinic-logo">{clinicLogoUrl ? <img src={clinicLogoUrl} alt={`Logo de ${activeOrganization?.organization.name ?? "la clínica"}`} /> : <BrandIcon name="institucion" size={56} />}</div>
              <span>Tu clínica</span><strong>{activeOrganization?.organization.name ?? "Retina Care"}</strong>
            </div>
            <nav aria-label="Navegación principal" onKeyDown={(event) => {
              const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
              if (!keys.includes(event.key)) return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".radial-nav-item"));
              const index = items.findIndex((item) => item === document.activeElement);
              if (index < 0) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }}>
              {allowedNavigation.map(({ id, label, description, icon }, index) => {
                // Restore alternativeFront's curved sidebar; distribute only allowed routes along its arc.
                const angle = (-65 + index * 130 / Math.max(1, allowedNavigation.length - 1)) * Math.PI / 180;
                const position = { "--radial-index": index, "--radial-x": Math.cos(angle), "--radial-y": Math.sin(angle) } as CSSProperties;
                return <div className={`radial-nav-entry${activePage === id ? " active" : ""}`} key={id} style={position}>
                  <button aria-current={activePage === id ? "page" : undefined} className="radial-nav-item" onClick={() => navigate(id)} title={description} type="button"><BrandIcon name={icon} size={21} /><span>{label}</span></button>
                  <button aria-expanded={helpPage === id} aria-controls={helpPage === id ? `radial-help-${id}` : undefined} aria-label={`¿Para qué sirve ${label}?`} className="radial-nav-help" onClick={() => setHelpPage((current) => current === id ? null : id)} type="button"><CircleHelp aria-hidden="true" size={17} /></button>
                </div>;
              })}
            </nav>
            <div className="radial-foot"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Entorno de demostración</strong><span>Usá únicamente datos ficticios.</span></div></div>
          </div>
          {helpPage ? <div className="radial-help-panel"><p className="radial-nav-description" role="status" id={`radial-help-${helpPage}`}>{allowedNavigation.find((item) => item.id === helpPage)?.description}</p><button className="radial-help-close" type="button" onClick={() => { navigationRef.current?.querySelector<HTMLButtonElement>('.radial-nav-help[aria-expanded="true"]')?.focus(); setHelpPage(null); }}>Cerrar ayuda</button></div> : null}
        </aside>
        <button ref={menuRef} className="radial-menu-toggle" aria-controls="workspace-navigation" aria-expanded={radialOpen} aria-label={radialOpen ? "Cerrar navegación" : "Abrir navegación"} onClick={(event) => { if (radialOpen) closeNavigation(); else { menuOpenerRef.current = event.currentTarget; setRadialOpen(true); } }} type="button">{radialOpen ? <X aria-hidden="true" size={24} /> : <Menu aria-hidden="true" size={24} />}</button>
      </div>

      <div ref={mainColumnRef} className="app-main-column">
        <header className="workspace-topbar">
          <button className="menu-button" aria-controls="workspace-navigation" aria-expanded={radialOpen} aria-label="Abrir menú desde la barra superior" onClick={(event) => { menuOpenerRef.current = event.currentTarget; setRadialOpen(true); }} type="button"><Menu aria-hidden="true" size={22} /></button>
          <img className="topbar-logo" src="/brand/logo.svg" alt="RetinaCare" /><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients"); }} role="search"><Search aria-hidden="true" size={18} /><label className="sr-only" htmlFor="global-search">Buscar en RetinaCare</label><input id="global-search" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar paciente..." value={globalSearch} /><span className="search-hint">Buscar</span></form><time className="topbar-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date())}</time>
          <ClinicNotificationCenter organizationId={!loading && !error ? activeOrganization?.organization.id : undefined} userId={user.id} canViewReports={!!activeOrganization && can(activeOrganization.role, "reports:generate")} onNavigate={navigate} />
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
