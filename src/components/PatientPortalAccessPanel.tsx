import { Link2, ShieldCheck, Unlink, UserRoundCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { PatientPortalAccount } from "../domain/patientPortal";

interface PatientPortalAccessPanelProps {
  account: PatientPortalAccount | null;
  disabled: boolean;
  loading: boolean;
  onLink: (userId: string) => Promise<void>;
  onRevoke: () => Promise<void>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PatientPortalAccessPanel({ account, disabled, loading, onLink, onRevoke }: PatientPortalAccessPanelProps) {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUserId = userId.trim();
    if (!UUID_PATTERN.test(normalizedUserId)) {
      setError("Ingrese el UUID exacto de auth.users. No se aceptan correos electrónicos.");
      return;
    }

    setError(null);
    try {
      await onLink(normalizedUserId);
      setUserId("");
    } catch {
      setError("No se pudo vincular la cuenta. Verifique que el UUID exista y que no tenga otro vínculo.");
    }
  }

  async function handleRevoke() {
    if (!globalThis.confirm("¿Revocar el acceso de esta cuenta al portal del paciente?")) return;
    setError(null);
    try {
      await onRevoke();
    } catch {
      setError("No se pudo revocar el acceso de la cuenta.");
    }
  }

  return (
    <section className="patient-portal-access" aria-labelledby="patient-portal-access-title">
      <div className="patient-portal-access-heading">
        <div>
          <p className="eyebrow">Acceso del paciente</p>
          <h2 id="patient-portal-access-title"><ShieldCheck aria-hidden="true" size={19} /> Portal de resultados aprobados</h2>
        </div>
        <span className="status-badge status-neutral">Solo administrador</span>
      </div>

      {loading ? <p className="patient-portal-access-state">Consultando vínculo de cuenta…</p> : null}

      {!loading && account?.status === "active" ? (
        <div className="patient-portal-access-linked" role="status">
          <UserRoundCheck aria-hidden="true" size={19} />
          <div>
            <strong>Cuenta vinculada</strong>
            <span className="patient-portal-access-id">{account.userId}</span>
            <small>El paciente solo verá reportes publicados explícitamente por un administrador o profesional autorizado.</small>
          </div>
          <button className="ghost-button danger" disabled={disabled} onClick={() => void handleRevoke()} type="button">
            <Unlink aria-hidden="true" size={16} /> Revocar acceso
          </button>
        </div>
      ) : null}

      {!loading && account?.status === "revoked" ? (
        <p className="patient-portal-access-state" role="status">
          El vínculo anterior fue revocado. Para un nuevo acceso, soporte debe crear otra cuenta de Auth y luego vincular su UUID.
        </p>
      ) : null}

      {!loading && !account ? (
        <form className="patient-portal-access-form" onSubmit={(event) => void handleLink(event)}>
          <label>
            UUID de usuario Auth
            <input
              autoComplete="off"
              disabled={disabled}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              spellCheck={false}
              value={userId}
            />
          </label>
          <button className="secondary-button" disabled={disabled || !userId.trim()} type="submit">
            <Link2 aria-hidden="true" size={17} /> Vincular cuenta
          </button>
          <small>La cuenta debe existir previamente en Supabase Auth. Esta pantalla no crea usuarios ni usa contraseñas o correos para autorizar.</small>
        </form>
      ) : null}

      {error ? <p className="patient-portal-access-error" role="alert">{error}</p> : null}
    </section>
  );
}
