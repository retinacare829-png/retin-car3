import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedNotificationBell } from "./AnimatedNotificationBell";

afterEach(() => vi.unstubAllGlobals());

describe("AnimatedNotificationBell", () => {
  it("can decorate an existing accessible trigger without nesting buttons or live regions", () => {
    const { container } = render(<button aria-label="Avisos, 4 sin leer"><AnimatedNotificationBell decorative count={4} /></button>);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector(".animated-notification-bell")).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards native button actions, ref, and popover accessibility", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(<AnimatedNotificationBell ref={ref} count={3} onClick={onClick} aria-expanded={false} aria-controls="notifications" />);
    const button = screen.getByRole("button", { name: "Notificaciones, 3 sin leer" });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "notifications");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("3 sin leer");
  });

  it("rings on increases, but never on mount, decreases, or unchanged totals", () => {
    const { container, rerender } = render(<AnimatedNotificationBell count={1} />);
    const initial = container.querySelector("svg");
    expect(initial).not.toHaveClass("is-ringing");
    rerender(<AnimatedNotificationBell count={2} />);
    const increased = container.querySelector("svg");
    expect(increased).not.toBe(initial);
    expect(increased).toHaveClass("is-ringing");
    rerender(<AnimatedNotificationBell count={1} />);
    expect(container.querySelector("svg")).toBe(increased);
    rerender(<AnimatedNotificationBell count={1} />);
    expect(container.querySelector("svg")).toBe(increased);
  });

  it.each([-3, Number.NaN, Number.POSITIVE_INFINITY])("normalizes %s to zero without a visible badge", (count) => {
    const { container } = render(<AnimatedNotificationBell count={count} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Notificaciones");
    expect(container.querySelector(".animated-notification-bell__badge")).toHaveAttribute("data-visible", "false");
  });

  it("floors totals, caps only the visual label, and exposes the full count in dot mode", () => {
    const { container, rerender } = render(<AnimatedNotificationBell count={123.8} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Notificaciones, 123 sin leer");
    expect(screen.getByText("99+")).toBeInTheDocument();
    rerender(<AnimatedNotificationBell count={123.8} variant="dot" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Notificaciones, 123 sin leer");
    expect(container.querySelector(".animated-notification-bell__badge--dot")).toBeEmptyDOMElement();
    rerender(<AnimatedNotificationBell count={2.9} max={Number.NaN} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("suppresses ring and count motion with reduced motion, retaining unread feedback", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container, rerender } = render(<AnimatedNotificationBell count={0} />);
    rerender(<AnimatedNotificationBell count={5} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-motion", "false");
    expect(container.querySelector("svg")).not.toHaveClass("is-ringing");
    expect(screen.getByRole("status")).toHaveTextContent("5 sin leer");
  });

  it("disables activation and motion and permits parent-owned announcements", () => {
    const onClick = vi.fn();
    const { rerender } = render(<AnimatedNotificationBell count={0} disabled announce={false} onClick={onClick} />);
    rerender(<AnimatedNotificationBell count={5} disabled announce={false} onClick={onClick} aria-label="Abrir avisos" />);
    const button = screen.getByRole("button", { name: "Abrir avisos" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("data-motion", "false");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
