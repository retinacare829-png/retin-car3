import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

afterEach(() => vi.unstubAllGlobals());

describe("preferencia de movimiento de la interfaz", () => {
  it("funciona cuando matchMedia no está disponible", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(useReducedMotion).result.current).toBe(false);
  });

  it("respeta la preferencia inicial, escucha cambios y limpia el listener", () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_type: string, callback: () => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const { result, unmount } = renderHook(useReducedMotion);
    expect(result.current).toBe(true);
    act(() => { media.matches = false; listener?.(); });
    expect(result.current).toBe(false);
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
