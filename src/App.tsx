import { lazy, Suspense } from "react";
import { AuthPage } from "./components/AuthPage";
import { LoadingState } from "./components/ui";
import { useAuthSession } from "./hooks/useAuthSession";
import { publicEnv } from "./lib/env";
import { sharedDemoUsesLocalSupabase } from "./lib/networkDiagnostics";

const ClinicWorkspace = lazy(() => import("./components/ClinicWorkspace").then((module) => ({ default: module.ClinicWorkspace })));

export function App() {
  const auth = useAuthSession();
  const localBackendOnRemoteBrowser = sharedDemoUsesLocalSupabase(
    globalThis.location.hostname,
    publicEnv.supabaseUrl,
    publicEnv.appEnv,
  );

  if (localBackendOnRemoteBrowser) {
    return <main className="app-shell"><div className="app-loading"><div className="notice notice-error" role="alert"><div><strong>Esta demo necesita un backend hospedado</strong><p>La aplicación apunta al Supabase local de desarrollo. Aunque la web abra por Wi‑Fi, ese backend puede fallar desde otros equipos y no está preparado para una demo compartida. Configura un proyecto Supabase hospedado y reinicia Vite.</p></div></div></div></main>;
  }

  return (
    <main className="app-shell">
      {auth.loading ? <div className="app-loading"><LoadingState label="Preparando RetinaCare" /></div> : null}
      {!auth.loading && !auth.user ? (
        <AuthPage
          clientConfigured={auth.clientConfigured}
          onResetPassword={auth.resetPassword}
          onSignIn={auth.signIn}
        />
      ) : null}
      {!auth.loading && auth.user ? <Suspense fallback={<div className="app-loading"><LoadingState label="Abriendo espacio clínico" /></div>}><ClinicWorkspace onSignOut={auth.signOut} user={auth.user} /></Suspense> : null}
      {auth.error ? <div className="global-error" role="alert">No fue posible iniciar RetinaCare. Intente nuevamente.</div> : null}
    </main>
  );
}
