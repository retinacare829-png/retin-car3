import { ArrowRight, ClipboardList, Search, Stethoscope, UserRoundPlus } from "lucide-react";
import { betaAiUnavailableMessage } from "../domain/screening";

export type WorkspaceDestination = "home" | "patients" | "screenings" | "workflow" | "pending" | "settings";

interface OperationalHomeProps {
  organizationName: string;
  onNavigate: (destination: WorkspaceDestination) => void;
}

const actions = [
  { title: "Registrar paciente", description: "Crear una ficha ficticia o un nuevo registro autorizado.", icon: UserRoundPlus, destination: "patients" as const },
  { title: "Buscar paciente", description: "Localizar una ficha por nombre, codigo o expediente.", icon: Search, destination: "patients" as const },
  { title: "Crear screening", description: "Abrir pacientes y comenzar un screening vinculado.", icon: Stethoscope, destination: "screenings" as const },
  { title: "Revisar pendientes", description: "Consultar screenings que requieren continuidad operativa.", icon: ClipboardList, destination: "pending" as const },
];

export function OperationalHome({ organizationName, onNavigate }: OperationalHomeProps) {
  return (
    <section className="operational-home" aria-labelledby="home-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inicio operativo</p>
          <h1 id="home-title">Buen dia. ¿Que necesita hacer?</h1>
          <p>Accesos directos para el flujo de {organizationName}. La beta valida el proceso clínico y no realiza diagnóstico.</p>
        </div>
        <span className="beta-label">Beta clínica · v0.6</span>
      </div>

      <div className="quick-actions" aria-label="Accesos rapidos">
        {actions.map(({ title, description, icon: Icon, destination }) => (
          <button className="quick-action" key={title} onClick={() => onNavigate(destination)} type="button">
            <span className="quick-action-icon"><Icon aria-hidden="true" size={22} /></span>
            <span><strong>{title}</strong><small>{description}</small></span>
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>

      <div className="home-information-grid">
        <article className="info-card">
          <p className="eyebrow">Recorrido recomendado</p>
          <h2>Demostracion clínica guiada</h2>
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
