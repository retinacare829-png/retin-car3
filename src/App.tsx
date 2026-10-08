import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthPage } from "./components/AuthPage";
import { LoadingState } from "./components/ui";
import { useAuthSession } from "./hooks/useAuthSession";
import { publicEnv } from "./lib/env";
import { sharedDemoUsesLocalSupabase } from "./lib/networkDiagnostics";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { createPatientPortalAdapter } from "./services/patientPortalService";

const ClinicWorkspace = lazy(() => import("./components/ClinicWorkspace").then((module) => ({ default: module.ClinicWorkspace })));
const PatientPortal = lazy(() => import("./components/PatientPortal").then((module) => ({ default: module.PatientPortal })));

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
      {!auth.loading && auth.user ? <AuthenticatedWorkspace onSignOut={auth.signOut} user={auth.user} /> : null}
      {auth.error ? <div className="global-error" role="alert">No fue posible iniciar RetinaCare. Intente nuevamente.</div> : null}
    </main>
  );
}

function AuthenticatedWorkspace({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const patientAdapter = useMemo(() => supabase ? createPatientPortalAdapter(supabase) : undefined, []);
  const [destination, setDestination] = useState<"loading" | "patient" | "clinic">("loading");

  useEffect(() => {
    let mounted = true;
    if (!patientAdapter) {
      setDestination("clinic");
      return () => { mounted = false; };
    }

    patientAdapter.getSnapshot()
      .then(() => { if (mounted) setDestination("patient"); })
      .catch(() => { if (mounted) setDestination("clinic"); });

    return () => { mounted = false; };
  }, [patientAdapter, user.id]);

  if (destination === "loading") {
    return <div className="app-loading"><LoadingState label="Determinando espacio de acceso" /></div>;
  }

  return <Suspense fallback={<div className="app-loading"><LoadingState label={destination === "patient" ? "Abriendo portal paciente" : "Abriendo espacio clínico"} /></div>}>
    {destination === "patient"
      ? <PatientPortal adapter={patientAdapter} onSignOut={onSignOut} user={user} />
      : <ClinicWorkspace onSignOut={onSignOut} user={user} />}
  </Suspense>;
}
