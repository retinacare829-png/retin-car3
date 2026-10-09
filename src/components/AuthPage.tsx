import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

interface AuthPageProps {
  clientConfigured: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

type AuthMode = "sign-in" | "reset-password";

function signInError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : "";
  if (/invalid login credentials/i.test(message)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(message)) return "Confirmá tu correo antes de iniciar sesión.";
  if (/fetch|network|failed to fetch/i.test(message)) return "No pudimos conectar. Revisá tu conexión e intentá de nuevo.";
  return "No pudimos completar la solicitud. Intentá de nuevo.";
}

export function AuthPage({ clientConfigured, onSignIn, onResetPassword }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        await onResetPassword(email.trim());
        setMessage("Si el correo está registrado, recibirás instrucciones para recuperar el acceso.");
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (caught) {
      setError(signInError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode() {
    setMode(isResetMode ? "sign-in" : "reset-password");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setMessage(null);
  }

  return (
    <section className="login-layout" aria-labelledby="login-heading">
      <div className="login-story">
        <a className="login-brand-link" href="#login-email" aria-label="Ir al inicio de sesión"><img className="login-brand" src="/brand/logo-light.svg" alt="RetinaCare" /></a>
        <span className="login-edition">Plataforma clínica · Beta</span>
        <div className="login-story-content">
          <p className="login-overline">Ver antes. Cuidar mejor.</p>
          <h1 id="login-heading">Cada imagen cuenta una historia.</h1>
          <p>Organizá pacientes, capturas y revisiones en un solo lugar.</p>
        </div>
        <div className="login-retina-art" aria-hidden="true"><img src="/brand/retina.svg" alt="" /><span className="login-art-caption">Una mirada más clara</span></div>
        <div className="login-story-steps" aria-label="Flujo clínico"><span><i>01</i> Captura</span><span><i>02</i> Revisión</span><span><i>03</i> Seguimiento</span></div>
      </div>

      <div className="login-access">
        <div className="login-access-top"><span className="login-access-mark" aria-hidden="true"><LockKeyhole size={18} /></span><span>Acceso a RetinaCare</span></div>
        <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
          <p className="login-kicker">{isResetMode ? "Recuperar acceso" : "Bienvenido de nuevo"}</p>
          <h2>{isResetMode ? "Recuperá tu acceso" : "Tu espacio de cuidado."}</h2>
          <p className="login-card-intro">
            {isResetMode
              ? "Te enviaremos un enlace para que puedas volver a entrar."
              : "Usá la cuenta que te asignaron en tu clínica para continuar."}
          </p>

          {!clientConfigured ? (
            <div className="login-alert" role="alert">El acceso aún no está configurado. Contactá al equipo de soporte.</div>
          ) : null}

          <div className="login-field">
            <label htmlFor="login-email">Correo electrónico</label>
            <span className="login-input-wrap">
              <Mail aria-hidden="true" size={18} />
              <input
                id="login-email"
                name="email"
                autoComplete="email"
                disabled={!clientConfigured || submitting}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@clinica.com"
                required
                type="email"
                value={email}
              />
            </span>
          </div>

          {!isResetMode ? (
            <div className="login-field">
              <div className="login-field-head">
                <label htmlFor="login-password">Contraseña</label>
                <button className="login-text-button" disabled={submitting} onClick={changeMode} type="button">¿La olvidaste?</button>
              </div>
              <span className="login-input-wrap">
                <LockKeyhole aria-hidden="true" size={18} />
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  disabled={!clientConfigured || submitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ingresá tu contraseña"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-controls="login-password"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="login-visibility"
                  disabled={submitting}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
                </button>
              </span>
            </div>
          ) : null}

          {error ? <div className="login-alert" role="alert">{error}</div> : null}
          {message ? <div className="login-message" role="status">{message}</div> : null}

          <button className="login-submit" disabled={!clientConfigured || submitting} type="submit">
            <span>{submitting ? "Un momento..." : isResetMode ? "Enviar enlace" : "Iniciar sesión"}</span>
            <ArrowRight aria-hidden="true" size={19} />
          </button>

          {isResetMode ? <button className="login-back" disabled={submitting} onClick={changeMode} type="button">Volver a iniciar sesión</button> : null}
        </form>
        <div className="login-access-foot"><ShieldCheck aria-hidden="true" size={17} /><span>Acceso protegido. No uses datos reales durante esta beta.</span></div>
      </div>
    </section>
  );
}
