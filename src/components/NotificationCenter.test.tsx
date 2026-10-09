import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicNotification } from "../domain/notifications";
import { useNotifications } from "../hooks/useNotifications";
import { ClinicNotificationCenter, NotificationCenter, type NotificationCenterProps } from "./NotificationCenter";

vi.mock("../hooks/useNotifications", () => ({ useNotifications: vi.fn() }));

const due: ClinicNotification = { id: "follow-up:1", kind: "follow_up_due", title: "Seguimiento para hoy", detail: "Control programado · 09/10/2026", urgent: true, destination: "workflow" };
const ready: ClinicNotification = { id: "approved-report-1", kind: "report_ready", title: "Reporte listo", detail: "Publicado el 09/10/2026", urgent: false, destination: "reports" };
function props(overrides: Partial<NotificationCenterProps> = {}): NotificationCenterProps {
  return { items: [due, ready], count: 2, loading: false, error: null, scopeKey: "org-a:user-a", onRefresh: vi.fn(), onNavigate: vi.fn(), ...overrides };
}
function open() { fireEvent.click(screen.getByRole("button", { name: "Notificaciones" })); }

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe("NotificationCenter", () => {
  it("uses the animated native button, exact accessible count and a bounded list disclosure", () => {
    const input = props({ count: 123 });
    render(<NotificationCenter {...input} />);
    const trigger = screen.getByRole("button", { name: "Notificaciones" });
    expect(trigger).toHaveClass("animated-notification-bell");
    expect(trigger).toHaveAccessibleDescription("123 notificaciones disponibles.");
    expect(within(trigger).getByText("99+")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    open();
    const panel = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(screen.getByRole("button", { name: "Cerrar notificaciones" })).toHaveFocus();
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    expect(panel).toHaveTextContent("Mostrando 2 de 123");
    expect(input.onRefresh).toHaveBeenCalledOnce();
  });

  it("opens with the keyboard and restores focus when dismissed with Escape or close", () => {
    render(<NotificationCenter {...props()} />);
    const trigger = screen.getByRole("button", { name: "Notificaciones" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Cerrar notificaciones" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificaciones" }));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on outside interaction and keyboard focus departure without trapping focus", () => {
    render(<><NotificationCenter {...props()} /><button type="button">Outside</button></>);
    const outside = screen.getByRole("button", { name: "Outside" });
    open();
    fireEvent.pointerDown(outside);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    act(() => outside.focus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });

  it("passes the actual item for patient report navigation and closes the panel", () => {
    const input = props({ items: [ready], count: 1, contextLabel: "Reportes aprobados" });
    render(<NotificationCenter {...input} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Reporte listo/ }));
    expect(input.onNavigate).toHaveBeenCalledWith("reports", ready);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveFocus();
    expect(useNotifications).not.toHaveBeenCalled();
  });

  it("distinguishes loading, error and verified empty states and offers retry", () => {
    const input = props({ items: [], count: null, loading: true });
    const { rerender } = render(<NotificationCenter {...input} />);
    open();
    expect(screen.getByText("Cargando notificaciones…")).toBeInTheDocument();
    expect(screen.queryByText("No hay notificaciones disponibles.")).not.toBeInTheDocument();
    rerender(<NotificationCenter {...input} loading={false} error="No se pudieron cargar las notificaciones." />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar");
    expect(screen.queryByText("No hay notificaciones disponibles.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(input.onRefresh).toHaveBeenCalledTimes(2);
    rerender(<NotificationCenter {...input} loading={false} count={0} />);
    expect(screen.getByText("No hay notificaciones disponibles.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveAccessibleDescription("0 notificaciones disponibles.");
  });

  it("closes the popover on scope change and disables access without an active scope", () => {
    const input = props();
    const { rerender } = render(<NotificationCenter {...input} />);
    open();
    rerender(<NotificationCenter {...input} scopeKey="org-b:user-a" items={[]} count={null} loading />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(due.detail)).not.toBeInTheDocument();
    rerender(<NotificationCenter {...input} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<NotificationCenter {...input} disabled />);
    expect(screen.getByRole("button", { name: "Notificaciones" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates to workflow and offers supplied section actions", () => {
    const input = props({ actions: [{ destination: "workflow", label: "Ver seguimientos" }] });
    render(<NotificationCenter {...input} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Seguimiento para hoy/ }));
    expect(input.onNavigate).toHaveBeenCalledWith("workflow", due);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimientos" }));
    expect(input.onNavigate).toHaveBeenLastCalledWith("workflow", undefined);
  });
});

describe("ClinicNotificationCenter", () => {
  it("scopes the hook by user and report permission, refreshing on open", () => {
    const refresh = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({ data: { today: "2026-10-09", items: [due], count: 1, followUpCount: 1, reportCount: 0 }, count: 1, loading: false, error: null, refresh });
    render(<ClinicNotificationCenter organizationId="org-a" userId="user-a" canViewReports={false} onNavigate={vi.fn()} />);
    expect(useNotifications).toHaveBeenCalledWith("org-a", { includeReports: false, scopeKey: "user-a" });
    open();
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByText("1 seguimientos para hoy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver reportes" })).not.toBeInTheDocument();
  });
});
