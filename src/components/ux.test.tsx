import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";
import { ClinicWorkspace } from "./ClinicWorkspace";
import { OperationalHome } from "./OperationalHome";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { EmptyState, LoadingState, StatusBadge } from "./ui";

// Este test cubre el estado desconectado de reportes; no debe depender del .env local.
vi.mock("../lib/supabase", () => ({ supabase: null }));

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

vi.mock("../hooks/useDashboard", () => ({
  useDashboard: () => ({
    loading: false, error: null,
    data: {
      totals: { patients: 12, screenings: 8, pending: 3, reviewed: 5, followUps: 2 },
      today: { pendingScreenings: 3, scheduledFollowUps: 1, pendingReviews: 2, newPatients: 1 },
      screeningsByMonth: [{ key: "2026-08", label: "ago", total: 8 }],
      statusDistribution: [{ status: "REVISADO", label: "Revisado", total: 5 }],
      recentActivity: [{ id: "event-1", title: "Screening creado", occurredAt: "2026-08-28T14:00:00Z" }],
      agenda: [{ id: "follow-1", title: "Control programado", detail: "Próximo seguimiento", occurredAt: "2026-08-28T16:00:00Z", priority: "high" }],
    },
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

  it("presenta layout, identidad y navegación activa", async () => {
    render(<ClinicWorkspace onSignOut={vi.fn()} user={demoUser} />);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "RetinaCare" })[0]).toBeInTheDocument();
    expect(screen.getAllByText("Clínica RetinaCare Demo").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumen clínico" })).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Revisiones pendientes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reportes" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Actividad clínica trazable" })).toBeInTheDocument());
    expect(screen.getByText("Conector de reportes pendiente")).toBeInTheDocument();
  });

  it("ofrece accesos rápidos y conserva el aviso de IA", () => {
    const onNavigate = vi.fn();
    render(<OperationalHome organizationId="org-demo" organizationName="Clínica Demo" role="clinic_admin" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Crear screening/i }));
    expect(onNavigate).toHaveBeenCalledWith("screenings");
    expect(screen.getByText("3", { selector: ".home-metrics strong" })).toBeInTheDocument();
    expect(screen.getByText("Seguimientos programados")).toBeInTheDocument();
    expect(screen.getByText(/Módulo de Inteligencia Artificial no disponible en esta versión beta/)).toBeInTheDocument();
  });

  it("no ofrece alta ni carga de imágenes al profesional", () => {
    render(<OperationalHome organizationId="org-demo" organizationName="Clínica Demo" role="authorized_professional" onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Registrar paciente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear screening/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subir imágenes/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buscar paciente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar workflow/i })).toBeInTheDocument();
  });

  it("renderiza estados vacíos, carga y badges sin depender solo del color", () => {
    render(<><EmptyState title="Sin revisiones" description="Todavía no hay revisiones." /><LoadingState label="Cargando revisión" /><StatusBadge label="En revisión" tone="progress" /></>);
    expect(screen.getByText("Sin revisiones")).toBeInTheDocument();
    expect(screen.getByText("Cargando revisión...")).toBeInTheDocument();
    expect(screen.getByText("En revisión")).toBeInTheDocument();
  });

  it("presenta métricas reales y bloques operativos del dashboard", () => {
    render(<ExecutiveDashboard organizationId="org-demo" organizationName="Clínica Demo" onNavigate={vi.fn()} />);
    expect(screen.getByText("Resumen del día")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Total Pacientes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Screenings por mes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actividad reciente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda de Hoy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo Paciente" })).toBeInTheDocument();
  });
});
