import { lazy, Suspense } from "react";
import { AuthPage } from "./components/AuthPage";
import { LoadingState } from "./components/ui";
import { useAuthSession } from "./hooks/useAuthSession";

const ClinicWorkspace = lazy(() => import("./components/ClinicWorkspace").then((module) => ({ default: module.ClinicWorkspace })));

export function App() {
  const auth = useAuthSession();

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
