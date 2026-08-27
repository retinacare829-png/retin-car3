import { ShieldCheck } from "lucide-react";
import { AuthPage } from "./components/AuthPage";
import { ClinicWorkspace } from "./components/ClinicWorkspace";
import { FoundationDashboard } from "./components/FoundationDashboard";
import { useAuthSession } from "./hooks/useAuthSession";
import logoUrl from "../assets/retinacare.jpeg";

export function App() {
  const auth = useAuthSession();

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Encabezado de RetinaCare">
        <img className="brand-logo" src={logoUrl} alt="RetinaCare" />
        <div className="beta-pill">
          <ShieldCheck aria-hidden="true" size={18} />
          Version beta
        </div>
      </header>

      {auth.loading ? <FoundationDashboard /> : null}
      {!auth.loading && !auth.user ? (
        <AuthPage
          clientConfigured={auth.clientConfigured}
          onResetPassword={auth.resetPassword}
          onSignIn={auth.signIn}
        />
      ) : null}
      {!auth.loading && auth.user ? <ClinicWorkspace onSignOut={auth.signOut} user={auth.user} /> : null}
      {auth.error ? <div className="global-error">{auth.error}</div> : null}
    </main>
  );
}
