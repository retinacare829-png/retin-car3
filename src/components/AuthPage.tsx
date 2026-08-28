import { FormEvent, useState } from "react";
import { KeyRound, LogIn, Mail, ShieldAlert } from "lucide-react";
import logoUrl from "../../assets/retinacare.jpeg";

interface AuthPageProps {
  clientConfigured: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

type AuthMode = "sign-in" | "reset-password";

export function AuthPage({ clientConfigured, onSignIn, onResetPassword }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isResetMode = mode === "reset-password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);

    try {
      if (isResetMode) {
        await onResetPassword(email);
        setMessage("Si el correo existe, recibira instrucciones de recuperacion.");
      } else {
        await onSignIn(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="auth-title">
      <div className="auth-copy">
        <img className="auth-logo" src={logoUrl} alt="RetinaCare" />
        <p className="eyebrow">Plataforma clínica · Version beta</p>
        <h1 id="auth-title">El flujo retinal, claro de principio a fin</h1>
        <p>
          Acceda al espacio seguro de su clínica para gestionar pacientes, imágenes y revisión profesional.
        </p>
        <div className="disclaimer-panel">
          <ShieldAlert aria-hidden="true" size={22} />
          <p>Prototipo para validación de flujo de trabajo. No destinado a diagnóstico médico.</p>
        </div>
      </div>

      <form className="auth-panel" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <h2>{isResetMode ? "Recuperar contraseña" : "Iniciar sesión"}</h2>
          <p>
            {isResetMode
              ? "Ingrese el correo institucional para solicitar recuperacion."
              : "Ingrese con una cuenta asignada a una clinica."}
          </p>
        </div>

        {!clientConfigured ? (
          <div className="setup-warning" role="alert">
            Configure `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para habilitar Auth.
          </div>
        ) : null}

        <label>
          Correo
          <input
            autoComplete="email"
            disabled={!clientConfigured || submitting}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        {!isResetMode ? (
          <label>
            Contrasena
            <input
              autoComplete="current-password"
              disabled={!clientConfigured || submitting}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}
        {message ? <div className="form-message">{message}</div> : null}

        <button className="primary-button" disabled={!clientConfigured || submitting} type="submit">
          {isResetMode ? <Mail aria-hidden="true" size={18} /> : <LogIn aria-hidden="true" size={18} />}
          {submitting ? "Procesando..." : isResetMode ? "Enviar recuperacion" : "Entrar"}
        </button>

        <button
          className="ghost-button"
          disabled={submitting}
          onClick={() => {
            setMode(isResetMode ? "sign-in" : "reset-password");
            setError(null);
            setMessage(null);
          }}
          type="button"
        >
          <KeyRound aria-hidden="true" size={18} />
          {isResetMode ? "Volver al inicio de sesion" : "Recuperar contrasena"}
        </button>
      </form>
    </section>
  );
}
