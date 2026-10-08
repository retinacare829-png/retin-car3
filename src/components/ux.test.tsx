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
    expect(screen.getByRole("heading", { name: /Cada imagen cuenta una historia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("mantiene el correo al solicitar recuperación y no conserva la contraseña", async () => {
    const onResetPassword = vi.fn().mockResolvedValue(undefined);
    render(<AuthPage clientConfigured onResetPassword={onResetPassword} onSignIn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "demo@clinica.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "clave-de-prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "¿La olvidaste?" }));
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    await waitFor(() => expect(onResetPassword).toHaveBeenCalledWith("demo@clinica.test"));
    expect(screen.getByRole("status")).toHaveTextContent(/Si el correo está registrado/i);
    fireEvent.click(screen.getByRole("button", { name: "Volver a iniciar sesión" }));
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("envía el correo limpio sin modificar la contraseña de acceso", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<AuthPage clientConfigured onResetPassword={vi.fn()} onSignIn={onSignIn} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: " demo@clinica.test " } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: " clave-con-espacios " } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith("demo@clinica.test", " clave-con-espacios "));
  });

  it("presenta layout, identidad y navegación activa", async () => {
    render(<ClinicWorkspace onSignOut={vi.fn()} user={demoUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
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

  it("abre el menú radial y conserva la navegación clínica", () => {
    render(<ClinicWorkspace onSignOut={vi.fn()} user={demoUser} />);
    const toggle = screen.getByRole("button", { name: "Abrir navegación" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar navegación" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pacientes" }));
    expect(screen.getByRole("button", { name: "Abrir navegación" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Abrir navegación" })).toHaveAttribute("aria-expanded", "false");
  });

  it("ofrece accesos rápidos y conserva el aviso de IA", () => {
    const onNavigate = vi.fn();
    render(<OperationalHome organizationId="org-demo" organizationName="Clínica Demo" role="clinic_admin" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Crear screening/i }));
    expect(onNavigate).toHaveBeenCalledWith("screenings");
    expect(screen.getByText("3", { selector: ".home-metrics strong" })).toBeInTheDocument();
    expect(screen.getByText("Seguimientos para hoy")).toBeInTheDocument();
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
