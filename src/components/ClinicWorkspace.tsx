import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bell, Building2, ChevronDown, ClipboardList, FileText, Home, LogOut, Menu, Search, Settings, Stethoscope, UsersRound, X } from "lucide-react";
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
  const palette = logoPalette ?? clinicThemes.retina;
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const navigate = (page: WorkspaceDestination) => { setActivePage(page); setMobileOpen(false); };
  return (
    <div className="clinical-app-shell" style={themeStyle}>
      <ToastViewport />
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className={mobileOpen ? "app-sidebar open" : "app-sidebar"} aria-label="Barra lateral de RetinaCare">
        <div className="sidebar-brand"><div className="sidebar-clinic-identity"><div className="sidebar-clinic-logo">{clinicLogoUrl ? <img src={clinicLogoUrl} alt={`Logo de ${activeOrganization?.organization.name ?? "la clínica"}`} /> : <span className="clinic-logo-placeholder"><Building2 aria-hidden="true" size={30} /><small>Logo pendiente</small></span>}</div><strong className="sidebar-clinic-name">{activeOrganization?.organization.name ?? "Clínica"}</strong></div><button className="mobile-close" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} type="button"><X size={20} /></button></div>
        <nav aria-label="Navegación principal">{navigation.filter((item) => !item.permission || (activeOrganization && can(activeOrganization.role, item.permission))).map(({ id, label, icon: Icon }) => <button aria-current={activePage === id ? "page" : undefined} className={activePage === id ? "nav-item active" : "nav-item"} key={id} onClick={() => navigate(id)} type="button"><Icon aria-hidden="true" size={19} /><span>{label}</span></button>)}</nav>
      </aside>
      {mobileOpen ? <button className="sidebar-scrim" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} type="button" /> : null}

      <div className="app-main-column">
        <header className="workspace-topbar">
          <button className="menu-button" aria-label="Abrir navegación" onClick={() => setMobileOpen(true)} type="button"><Menu size={22} /></button>
          <img className="topbar-logo" src={logoUrl} alt="RetinaCare" /><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients"); }} role="search"><Search aria-hidden="true" size={17} /><label className="sr-only" htmlFor="global-search">Buscar en RetinaCare</label><input id="global-search" placeholder="Buscar paciente..." /></form><time className="topbar-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date())}</time><button className="notification-button" aria-label="Notificaciones" type="button"><Bell aria-hidden="true" size={19} /></button>
          <div className="user-menu"><span className="user-avatar" aria-hidden="true">{(user.email?.[0] ?? "U").toUpperCase()}</span><div><strong>{user.email ?? "Usuario RetinaCare"}</strong><span>{activeOrganization ? roleLabels[activeOrganization.role] : "Rol no disponible"}</span></div><ChevronDown aria-hidden="true" size={16} /><button className="logout-button" onClick={() => void onSignOut()} type="button"><LogOut aria-hidden="true" size={18} /><span>Cerrar sesión</span></button></div>
        </header>

        <main className="workspace-content" id="main-content" tabIndex={-1}>
          {loading ? <LoadingState label="Cargando organización" /> : null}
          {error ? <ErrorNotice message="No se pudo cargar el contexto de la clínica. Verifique su conexión e intente nuevamente." /> : null}
          {!loading && !error && !activeOrganization ? <EmptyState icon={Building2} title="Sin organización activa" description="Su usuario necesita una membresía clínica activa para continuar." /> : null}
          {activeOrganization && organizations.length > 1 ? <label className="organization-selector compact-selector">Cambiar organización<select onChange={(event) => selectOrganization(event.target.value)} value={activeOrganization.organization.id}>{organizations.map((context) => <option key={context.organization.id} value={context.organization.id}>{context.organization.name} · {roleLabels[context.role]}</option>)}</select></label> : null}
          {activeOrganization && activePage === "home" ? <OperationalHome organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} onNavigate={navigate} /> : null}
          {activeOrganization && ["patients", "screenings", "workflow"].includes(activePage) ? <Suspense fallback={<LoadingState label="Cargando módulo clínico" />}><PatientManagement initialFocus={activePage as "patients" | "screenings" | "workflow"} organizationId={activeOrganization.organization.id} role={activeOrganization.role} user={user} /></Suspense> : null}
          {activeOrganization && activePage === "reports" ? <Suspense fallback={<LoadingState label="Cargando reportes" />}><ReportsPage adapter={reportsAdapter} organizationId={activeOrganization.organization.id} organizationName={activeOrganization.organization.name} role={activeOrganization.role} /></Suspense> : null}
          {activeOrganization && activePage === "settings" && can(activeOrganization.role, "organization:manage") ? <ClinicSettings context={activeOrganization} userEmail={user.email ?? "Usuario RetinaCare"} onRegisterClinic={registerClinic} onSaveBranding={saveBranding} /> : null}
        </main>
      </div>
    </div>
  );
}
