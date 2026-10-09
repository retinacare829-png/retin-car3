import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicWorkspace } from "./ClinicWorkspace";

const state = vi.hoisted(() => ({
  role: "clinic_admin",
  clinicId: "clinic-demo",
  logoPath: null as string | null,
  brandTheme: "retina",
  downloadLogo: vi.fn(),
  palette: { primary: "#183b89", dark: "#102557", soft: "#e5ecfa", sidebar: "#112440", accent: "#9ab5f2" },
}));
vi.mock("../hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => ({
    activeOrganization: { organization: { id: state.clinicId, name: "Clínica Radial", brandTheme: state.brandTheme, logoPath: state.logoPath }, role: state.role },
    organizations: [], loading: false, error: null, logoRevision: 0,
    selectOrganization: vi.fn(), registerClinic: vi.fn(), saveBranding: vi.fn(),
  }),
}));
vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../services/reportsAdapter", () => ({ createReportsAdapter: vi.fn() }));
vi.mock("../services/organizationService", () => ({ OrganizationService: class { downloadLogo = state.downloadLogo; } }));
vi.mock("../domain/clinicBranding", async (importOriginal) => ({
  ...await importOriginal<typeof import("../domain/clinicBranding")>(), paletteFromLogo: vi.fn().mockResolvedValue(state.palette),
}));
vi.mock("./OperationalHome", () => ({ OperationalHome: () => <h1>Inicio clínico</h1> }));
vi.mock("./PatientManagement", () => ({ PatientManagement: ({ initialFocus }: { initialFocus: string }) => <h1>{initialFocus}</h1> }));
vi.mock("./ReportsPage", () => ({ ReportsPage: () => <h1>Reportes clínicos</h1> }));
vi.mock("./ClinicSettings", () => ({ ClinicSettings: () => <h1>Identidad de clínica</h1> }));
vi.mock("./NotificationCenter", () => ({ ClinicNotificationCenter: () => <button>Notificaciones</button> }));

const user = { id: "user-demo", email: "demo@example.test" } as User;
const open = () => fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));

beforeEach(() => {
  state.role = "clinic_admin";
  state.clinicId = "clinic-demo";
  state.logoPath = null;
  state.brandTheme = "retina";
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("navegación radial restaurada", () => {
  it.each([true, false])("mantiene el menú cerrado y fuera del foco en escritorio/móvil (%s)", (wide) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: wide })));
    const { container } = render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    expect(container.querySelector(".radial-workspace")).toBeInTheDocument();
    expect(container.querySelector(".workspace-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector(".radial-sidebar")).toHaveAttribute("hidden");
    expect(screen.getByRole("img", { name: "RetinaCare" })).toHaveAttribute("src", "/brand/logo.svg");
    expect(screen.getByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
    open();
    expect(screen.getByRole("dialog", { name: "Menú de RetinaCare" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Inicio" })).toHaveFocus();
    expect(container.querySelector(".app-main-column")).toHaveProperty("inert", true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it.each([
    ["clinic_admin", 6, true, true],
    ["authorized_professional", 5, true, false],
    ["technical_staff", 4, false, false],
  ] as const)("conserva permisos y distribuye las rutas de %s en el arco", (role, count, reports, settings) => {
    state.role = role;
    render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav.querySelectorAll(".radial-nav-item")).toHaveLength(count);
    expect(Boolean(within(nav).queryByRole("button", { name: "Reportes" }))).toBe(reports);
    expect(Boolean(within(nav).queryByRole("button", { name: "Configuración" }))).toBe(settings);
    const positions = Array.from(nav.querySelectorAll<HTMLElement>(".radial-nav-entry"), (entry) => entry.style.getPropertyValue("--radial-x"));
    expect(new Set(positions).size).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: /Acceso rápido:/ })).not.toBeInTheDocument();
  });

  it("recorre rutas con flechas y encierra Tab dentro del diálogo", () => {
    render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    const first = screen.getByRole("button", { name: "Inicio" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Pacientes" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("button", { name: "Configuración" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    const close = screen.getByRole("button", { name: "Cerrar navegación" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it.each(["Abrir navegación", "Abrir menú desde la barra superior"])("Escape restaura el foco al activador %s", (label) => {
    const { container } = render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    const opener = screen.getByRole("button", { name: label });
    fireEvent.click(opener);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(container.querySelector(".app-main-column")).toHaveProperty("inert", false);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it.each(["Cerrar menú radial", "Cerrar navegación"])("cierra con %s y devuelve el foco", (label) => {
    render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    const opener = screen.getByRole("button", { name: "Abrir navegación" });
    open();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it.each([
    ["Pacientes", "patients"], ["Screenings", "screenings"], ["Workflow Clínico", "workflow"],
    ["Reportes", "Reportes clínicos"], ["Configuración", "Identidad de clínica"],
  ])("preserva la ruta %s y su selección al reabrir", async (label, heading) => {
    render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
    open();
    const current = screen.getByRole("button", { name: label });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveFocus();
  });

  it("muestra la ayuda sin navegar y devuelve el foco al cerrarla", () => {
    render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    const help = screen.getByRole("button", { name: "¿Para qué sirve Workflow Clínico?" });
    fireEvent.click(help);
    expect(screen.getByRole("status")).toHaveTextContent("El profesional revisa");
    expect(help).toHaveAttribute("aria-controls", screen.getByRole("status").id);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar ayuda" }));
    expect(help).toHaveFocus();
    expect(help).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  });

  it("conserva el logo completo y aplica los colores extraídos de la clínica", async () => {
    const createUrl = vi.fn(() => "blob:clinic-logo");
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }));
    state.logoPath = "clinic-demo/logo";
    state.brandTheme = "logo";
    state.downloadLogo.mockResolvedValue(new Blob(["logo"], { type: "image/png" }));
    const { container } = render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    expect(await screen.findByRole("img", { name: "Logo de Clínica Radial" })).toHaveAttribute("src", "blob:clinic-logo");
    await waitFor(() => expect(container.firstElementChild).toHaveStyle({ "--rc-primary": state.palette.primary, "--rc-sidebar-bg": state.palette.sidebar }));
    expect(screen.getByText("Clínica Radial")).toBeInTheDocument();
  });

  it("limpia el bloqueo de scroll al desmontarse abierto", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<ClinicWorkspace user={user} onSignOut={vi.fn()} />);
    open();
    act(() => { unmount(); });
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
});
