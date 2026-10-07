import { ArrowUp, ArrowRight, CalendarDays, ClipboardList, ImagePlus, Search, Stethoscope, UserRoundPlus } from "lucide-react";
import { betaAiUnavailableMessage } from "../domain/screening";
import { can } from "../domain/permissions";
import type { Role } from "../domain/roles";

export type WorkspaceDestination = "home" | "patients" | "screenings" | "workflow" | "dashboard" | "reports" | "settings";

interface OperationalHomeProps {
  organizationName: string;
  role?: Role;
  onNavigate: (destination: WorkspaceDestination) => void;
}

const actions = [
  { title: "Registrar paciente", description: "Crear una ficha ficticia o un nuevo registro autorizado.", icon: UserRoundPlus, destination: "patients" as const },
  { title: "Buscar paciente", description: "Localizar una ficha por nombre o identificador.", icon: Search, destination: "patients" as const },
  { title: "Crear screening", description: "Abrir pacientes y comenzar un screening vinculado.", icon: Stethoscope, destination: "screenings" as const },
  { title: "Revisar pendientes", description: "Consultar screenings que requieren continuidad operativa.", icon: ClipboardList, destination: "dashboard" as const },
];

export function OperationalHome({ organizationName, role = "clinic_admin", onNavigate }: OperationalHomeProps) {
  const visibleActions = actions.filter((action) => action.title === "Registrar paciente" ? can(role, "patients:write") : action.title === "Crear screening" ? can(role, "screenings:create") : true);
  const canUpload = can(role, "images:upload");
  return (
    <section className="operational-home" aria-labelledby="home-title">
      <div className="page-heading">
        <div>
          <h1 id="home-title">Buen día, ¿qué necesita hacer?</h1>
          <p>Un espacio claro para organizar pacientes, imágenes y revisiones de {organizationName}.</p>
        </div>
        <span className="beta-label">Espacio clínico · beta</span>
      </div>

      {canUpload ? <article className="upload-hero">
        <div className="upload-hero-copy">
          <p className="eyebrow">Captura retinal</p>
          <h2>Sube las imágenes de tu próximo screening</h2>
          <p>Guarda OD y OI en un espacio privado, revisa su calidad y continúa el flujo con el profesional autorizado.</p>
          <button className="hero-upload-button" onClick={() => onNavigate("screenings")} type="button"><ImagePlus aria-hidden="true" size={18} />Subir imágenes <ArrowUp aria-hidden="true" size={17} /></button>
          <small>JPG, PNG o WEBP · hasta 15 MB por imagen</small>
        </div>
        <div className="retina-art" aria-hidden="true"><span /><i /><b /></div>
      </article> : null}

      <div className="quick-actions" aria-label="Accesos rapidos">
        {visibleActions.map(({ title, description, icon: Icon, destination }) => (
          <button className="quick-action" key={title} onClick={() => onNavigate(destination)} type="button">
            <span className="quick-action-icon"><Icon aria-hidden="true" size={22} /></span>
            <span><strong>{title}</strong><small>{description}</small></span>
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>

      <div className="home-information-grid home-information-grid-balanced">
        <article className="info-card recent-home-card">
          <div className="section-title-row"><div><p className="eyebrow">Accesos frecuentes</p><h2>Lo que puedes hacer ahora</h2></div><CalendarDays aria-hidden="true" size={22} /></div>
          <div className="home-button-list">
            {visibleActions.filter(({ destination }) => destination !== "screenings").slice(0, 3).map(({ title, description, icon: Icon, destination }) => <button className="home-list-button" key={title} onClick={() => onNavigate(destination)} type="button"><span><Icon aria-hidden="true" size={19} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight aria-hidden="true" size={16} /></button>)}
          </div>
        </article>
        <article className="info-card">
          <p className="eyebrow">Recorrido recomendado</p>
          <h2>Demostración clínica guiada</h2>
          <ol className="demo-steps">
            <li>Busque un paciente ficticio.</li>
            <li>Abra un screening y revise OD/OI.</li>
            <li>Complete calidad, revisión y seguimiento.</li>
          </ol>
          <button className="secondary-button" onClick={() => onNavigate("patients")} type="button">Comenzar recorrido <ArrowRight aria-hidden="true" size={17} /></button>
        </article>
        <article className="info-card ai-info-card">
          <p className="eyebrow">Alcance de esta versión</p>
          <h2>Revisión exclusivamente profesional</h2>
          <p>{betaAiUnavailableMessage}</p>
          <span className="scope-note">Sin inferencias, clasificaciones ni resultados automáticos.</span>
        </article>
      </div>
    </section>
  );
}
