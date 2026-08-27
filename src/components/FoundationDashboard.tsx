import { ClipboardCheck, Database, FileText, LockKeyhole, Network, Stethoscope } from "lucide-react";
import { BETA_AI_ANALYSIS_STATUS } from "../domain/retinalAnalysisService";

const foundations = [
  {
    title: "Arquitectura multi-clinica",
    description: "Preparada para organizaciones, roles y aislamiento de datos con Supabase y RLS.",
    icon: Network,
  },
  {
    title: "Privacidad por diseno",
    description: "Variables de entorno, almacenamiento privado previsto y auditoria sin texto clinico innecesario.",
    icon: LockKeyhole,
  },
  {
    title: "Flujo clinico verificable",
    description: "La beta validara captura, revision, seguimiento, historial y reporte sin diagnosticar.",
    icon: ClipboardCheck,
  },
  {
    title: "Frontera para IA futura",
    description: "Contrato desacoplado para integrar inferencia validada en fases posteriores.",
    icon: Stethoscope,
  },
];

export function FoundationDashboard() {
  return (
    <section className="foundation">
      <div className="hero">
        <p className="eyebrow">Fase 0 completando fundacion tecnica</p>
        <h1>Plataforma beta para tamizaje y gestion de retina diabetica</h1>
        <p className="hero-copy">
          Prototipo para validacion de flujo de trabajo en clinicas. No destinado a diagnostico medico.
        </p>
      </div>

      <div className="status-band" role="status" aria-live="polite">
        <div>
          <span className="status-label">Analisis automatizado</span>
          <strong>No disponible en version beta.</strong>
        </div>
        <code>{BETA_AI_ANALYSIS_STATUS}</code>
      </div>

      <div className="foundation-grid" aria-label="Fundamentos de la beta">
        {foundations.map((item) => {
          const Icon = item.icon;
          return (
            <article className="foundation-card" key={item.title}>
              <Icon aria-hidden="true" size={24} />
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          );
        })}
      </div>

      <section className="document-list" aria-label="Documentacion inicial">
        <FileText aria-hidden="true" size={22} />
        <div>
          <h2>Documentacion base lista para iterar por fases</h2>
          <p>
            Producto, arquitectura, seguridad, intended use, plan, decisiones, demo clinica y entrevista clinica.
          </p>
        </div>
        <Database aria-hidden="true" size={22} />
      </section>
    </section>
  );
}
