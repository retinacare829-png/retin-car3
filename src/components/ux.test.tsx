import { fireEvent, render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";
import { ClinicWorkspace } from "./ClinicWorkspace";
import { OperationalHome } from "./OperationalHome";
import { EmptyState, LoadingState, StatusBadge } from "./ui";

const selectOrganization = vi.fn();

vi.mock("../hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => ({
    activeOrganization: { organization: { id: "org-demo", name: "Clínica RetinaCare Demo" }, role: "clinic_admin" },
    error: null,
    loading: false,
    organizations: [{ organization: { id: "org-demo", name: "Clínica RetinaCare Demo" }, role: "clinic_admin" }],
    selectOrganization,
  }),
}));

const demoUser = { id: "user-demo", email: "demo@retinacare.test" } as User;

describe("UX de la demo clínica", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza logo y acceso clínico en login", () => {
    render(<AuthPage clientConfigured onResetPassword={vi.fn()} onSignIn={vi.fn()} />);
    expect(screen.getByRole("img", { name: "RetinaCare" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /El flujo retinal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("presenta layout, identidad y navegación activa", () => {
    render(<ClinicWorkspace onSignOut={vi.fn()} user={demoUser} />);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "RetinaCare" })[0]).toBeInTheDocument();
    expect(screen.getByText("Clínica RetinaCare Demo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }));
    expect(screen.getByRole("heading", { name: "Pendientes" })).toBeInTheDocument();
    expect(screen.getByText("Sin pendientes para mostrar")).toBeInTheDocument();
  });

  it("ofrece accesos rápidos y conserva el aviso de IA", () => {
    const onNavigate = vi.fn();
    render(<OperationalHome organizationName="Clínica Demo" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Crear screening/i }));
    expect(onNavigate).toHaveBeenCalledWith("screenings");
    expect(screen.getByText("Módulo de Inteligencia Artificial no disponible en esta versión beta.")).toBeInTheDocument();
  });

  it("renderiza estados vacíos, carga y badges sin depender solo del color", () => {
    render(<><EmptyState title="Sin revisiones" description="Todavía no hay revisiones." /><LoadingState label="Cargando revisión" /><StatusBadge label="En revisión" tone="progress" /></>);
    expect(screen.getByText("Sin revisiones")).toBeInTheDocument();
    expect(screen.getByText("Cargando revisión...")).toBeInTheDocument();
    expect(screen.getByText("En revisión")).toBeInTheDocument();
  });
});
