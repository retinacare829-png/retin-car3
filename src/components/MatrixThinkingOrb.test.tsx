import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixThinkingOrb } from "./MatrixThinkingOrb";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("MatrixThinkingOrb", () => {
  it("renders only thinking feedback, with no demo controls, and disappears when inactive", () => {
    const { container, rerender } = render(<MatrixThinkingOrb label="Preparando análisis…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando análisis…");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<MatrixThinkingOrb active={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("can leave announcements to the parent and gives each matrix a unique mask", () => {
    const { container } = render(<><MatrixThinkingOrb announce={false} /><MatrixThinkingOrb announce={false} /></>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const masks = Array.from(container.querySelectorAll("mask"), (mask) => mask.id);
    expect(new Set(masks).size).toBe(2);
    const references = Array.from(container.querySelectorAll("g[mask]"), (group) => group.getAttribute("mask"));
    expect(references).toEqual(masks.map((id) => `url(#${id})`));
  });

  it("stops motion immediately when the reduced-motion preference changes", () => {
    const media = new EventTarget();
    Object.defineProperty(media, "matches", { configurable: true, value: false });
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const { container } = render(<MatrixThinkingOrb />);
    expect(container.firstElementChild).toHaveAttribute("data-animated", "true");
    Object.defineProperty(media, "matches", { value: true });
    act(() => { media.dispatchEvent(new Event("change")); });
    expect(container.firstElementChild).toHaveAttribute("data-animated", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Analizando imagen…");
  });

  it("pauses in hidden tabs and cleans up its visibility listener", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { container, unmount } = render(<MatrixThinkingOrb />);
    hidden.mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.firstElementChild).toHaveAttribute("data-animated", "false");
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.firstElementChild).toHaveAttribute("data-animated", "true");
    unmount();
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("pauses offscreen and disconnects its observer on inactivity", () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    let setVisible: (visible: boolean) => void = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        setVisible = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe = observe;
      disconnect = disconnect;
    });
    const { container, rerender } = render(<MatrixThinkingOrb />);
    expect(observe).toHaveBeenCalledWith(container.firstElementChild);
    act(() => { setVisible(false); });
    expect(container.firstElementChild).toHaveAttribute("data-animated", "false");
    act(() => { setVisible(true); });
    expect(container.firstElementChild).toHaveAttribute("data-animated", "true");
    rerender(<MatrixThinkingOrb active={false} />);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
