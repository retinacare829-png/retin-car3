import { ShieldCheck } from "lucide-react";
import { FoundationDashboard } from "./components/FoundationDashboard";
import logoUrl from "../assets/retinacare.jpeg";

export function App() {
  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Encabezado de RetinaCare">
        <img className="brand-logo" src={logoUrl} alt="RetinaCare" />
        <div className="beta-pill">
          <ShieldCheck aria-hidden="true" size={18} />
          Version beta
        </div>
      </header>

      <FoundationDashboard />
    </main>
  );
}
