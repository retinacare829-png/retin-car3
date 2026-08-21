import { Building2, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { roleLabels } from "../domain/roles";
import { useOrganizationContext } from "../hooks/useOrganizationContext";

interface ClinicWorkspaceProps {
  user: User;
  onSignOut: () => Promise<void>;
}

export function ClinicWorkspace({ user, onSignOut }: ClinicWorkspaceProps) {
  const { activeOrganization, error, loading, organizations, selectOrganization } = useOrganizationContext(user);

  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Sesion activa</p>
          <h1 id="workspace-title">Consola de organizacion</h1>
          <p>
            Base de Fase 1 para trabajar con clinicas, usuarios y roles antes de registrar pacientes.
          </p>
        </div>
        <button className="ghost-button" onClick={() => void onSignOut()} type="button">
          <LogOut aria-hidden="true" size={18} />
          Cerrar sesion
        </button>
      </div>

      <div className="workspace-grid">
        <article className="identity-panel">
          <UsersRound aria-hidden="true" size={24} />
          <h2>Usuario autenticado</h2>
          <p>{user.email ?? "Correo no disponible"}</p>
        </article>

        <article className="identity-panel">
          <Building2 aria-hidden="true" size={24} />
          <h2>Organizacion activa</h2>
          {loading ? <p>Cargando organizaciones...</p> : null}
          {!loading && activeOrganization ? (
            <>
              <p>{activeOrganization.organization.name}</p>
              <strong>{roleLabels[activeOrganization.role]}</strong>
            </>
          ) : null}
          {!loading && !activeOrganization ? <p>No hay membresias activas para este usuario.</p> : null}
        </article>

        <article className="identity-panel">
          <ShieldCheck aria-hidden="true" size={24} />
          <h2>Aislamiento multi-clinica</h2>
          <p>Las politicas RLS limitan organizaciones y membresias a usuarios autenticados y activos.</p>
        </article>
      </div>

      {organizations.length > 1 ? (
        <label className="organization-selector">
          Cambiar organizacion
          <select
            onChange={(event) => selectOrganization(event.target.value)}
            value={activeOrganization?.organization.id ?? ""}
          >
            {organizations.map((context) => (
              <option key={context.organization.id} value={context.organization.id}>
                {context.organization.name} - {roleLabels[context.role]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}

      <div className="status-band" role="status">
        <div>
          <span className="status-label">Fase actual</span>
          <strong>Autenticacion y organizaciones configuradas.</strong>
        </div>
        <code>FASE_1</code>
      </div>
    </section>
  );
}
