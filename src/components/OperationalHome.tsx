import { ArrowRight, ClipboardList, ImagePlus, Search, Stethoscope, UserRoundPlus, UsersRound } from "lucide-react";
import { betaAiUnavailableMessage } from "../domain/screening";
import { can } from "../domain/permissions";
import type { Role } from "../domain/roles";
import { useDashboard } from "../hooks/useDashboard";
import { ErrorNotice, LoadingState } from "./ui";

export type WorkspaceDestination = "home" | "patients" | "screenings" | "workflow" | "reports" | "settings";

interface OperationalHomeProps {
  organizationId: string;
  organizationName: string;
  role: Role;
  onNavigate: (destination: WorkspaceDestination) => void;
}

export function OperationalHome({ organizationId, organizationName, role, onNavigate }: OperationalHomeProps) {
  const { data, error, loading } = useDashboard(organizationId);
  const actions = [
    { title: "Buscar paciente", description: "Consultar su ficha y sus screenings.", icon: Search, destination: "patients" as const, visible: can(role, "patients:read") },
    { title: "Registrar paciente", description: "Crear una nueva ficha clínica.", icon: UserRoundPlus, destination: "patients" as const, visible: can(role, "patients:write") },
    { title: "Crear screening", description: "Iniciar un screening para un paciente.", icon: Stethoscope, destination: "screenings" as const, visible: can(role, "screenings:create") },
    { title: "Subir imágenes", description: "Continuar la captura de OD y OI.", icon: ImagePlus, destination: "screenings" as const, visible: can(role, "images:upload") },
    { title: "Revisar workflow", description: "Atender revisiones y seguimientos.", icon: ClipboardList, destination: "workflow" as const, visible: can(role, "workflow:review") },
  ].filter((action) => action.visible);

  return (
    <section className="operational-home" aria-labelledby="home-title">
      <div className="page-heading home-heading">
        <div><p className="eyebrow">Espacio clínico</p><h1 id="home-title">Inicio</h1><p>Resumen operativo de {organizationName}.</p></div>
      </div>

      {loading ? <LoadingState label="Cargando resumen clínico" /> : error ? <ErrorNotice message="No fue posible consultar los indicadores. Verifique su conexión e intente nuevamente." /> : <>
        <section className="home-summary" aria-labelledby="home-summary-title">
          <div className="home-section-heading"><div><p className="eyebrow">Panorama</p><h2 id="home-summary-title">Resumen clínico</h2></div><span>Datos de la clínica</span></div>
          <div className="home-metrics">
            <article><UsersRound aria-hidden="true" size={20} /><strong>{data.totals.patients}</strong><span>Pacientes</span></article>
            <article><Stethoscope aria-hidden="true" size={20} /><strong>{data.totals.screenings}</strong><span>Screenings</span></article>
            <article><ClipboardList aria-hidden="true" size={20} /><strong>{data.totals.pending}</strong><span>Pendientes</span></article>
          </div>
        </section>

        <section className="home-pending" aria-labelledby="home-pending-title">
          <div className="home-section-heading"><div><p className="eyebrow">Prioridades</p><h2 id="home-pending-title">Por atender</h2></div></div>
          <div className="home-pending-grid">
            <p><strong>{data.today.pendingReviews}</strong><span>Revisiones pendientes</span></p>
            <p><strong>{data.today.pendingScreenings}</strong><span>Screenings pendientes</span></p>
            <p><strong>{data.today.scheduledFollowUps}</strong><span>Seguimientos para hoy</span></p>
          </div>
          {data.today.pendingReviews === 0 && data.today.pendingScreenings === 0 && data.today.scheduledFollowUps === 0 ? <p className="home-empty-note">No hay tareas pendientes.</p> : null}
        </section>
      </>}

      <section className="home-next" aria-labelledby="home-next-title">
        <div className="home-section-heading"><div><p className="eyebrow">Accesos</p><h2 id="home-next-title">Continuar el trabajo</h2></div></div>
        <div className="home-action-grid">
          {actions.map(({ title, description, icon: Icon, destination }) => <button className="home-action" key={title} onClick={() => onNavigate(destination)} type="button"><Icon aria-hidden="true" size={20} /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight aria-hidden="true" size={17} /></button>)}
        </div>
      </section>
      <p className="home-scope-note">{betaAiUnavailableMessage} La revisión clínica corresponde al profesional autorizado.</p>
    </section>
  );
}
