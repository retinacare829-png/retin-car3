import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardMonth } from "../domain/dashboard";
import { HomeScreeningChart } from "./HomeScreeningChart";

// Vitest strips CSS imports (including ?raw) in this jsdom configuration.
const chartCss = readFileSync("src/components/HomeScreeningChart.css", "utf8");

const months: DashboardMonth[] = [
  { key: "2026-07", label: "jul", total: 4 },
  { key: "2026-08", label: "ago", total: 0 },
  { key: "2026-09", label: "sep", total: 9 },
];

beforeEach(() => {
  // jsdom has no canvas text measurement; TanStack uses its built-in fallback.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HomeScreeningChart: entradas accesibles de TanStack", () => {
  function finishAnimation(element: Element, name: string) {
    // jsdom has no AnimationEvent constructor; dispatch its browser contract.
    fireEvent(element, Object.assign(new Event("animationend", { bubbles: true }), { animationName: name }));
  }

  it("conserva las barras, sus datos y los ejes con una entrada desde la base", () => {
    const { container } = render(<HomeScreeningChart months={months} type="bar" />);
    const chart = screen.getByRole("img", { name: /gráfico de barras/ });
    expect(chart).toHaveAttribute("tabindex", "0");
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "full");
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-chart-type", "bar");
    expect(chart.querySelectorAll(".ts-chart__bar-y > rect, .ts-chart__bar-y > path")).toHaveLength(3);
    expect(screen.getByText("13 screenings en los últimos seis meses")).toBeInTheDocument();
    const data = screen.getByRole("list", { name: "Datos del gráfico" });
    for (const month of months) expect(within(data).getByText(`${month.label}: ${month.total} screenings`)).toBeInTheDocument();
  });

  it("reinicia la entrada al cambiar tipo y normaliza únicamente el trazo de datos", () => {
    const { container, rerender } = render(<HomeScreeningChart months={months} type="bar" />);
    const bars = screen.getByRole("img", { name: /gráfico de barras/ });
    rerender(<HomeScreeningChart months={months} type="line" />);
    const line = screen.getByRole("img", { name: /gráfico de líneas/ });
    expect(line).not.toBe(bars);
    expect(bars).not.toBeInTheDocument();
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-chart-type", "line");
    const path = line.querySelector(".ts-chart__line > path");
    expect(path).toHaveAttribute("pathLength", "1");
    expect(path).toHaveAttribute("d", expect.stringMatching(/^M/));
    expect(line.querySelectorAll('[pathLength="1"]')).toHaveLength(1);
    expect(line.querySelectorAll(".ts-chart__line > circle")).toHaveLength(3);
    rerender(<HomeScreeningChart months={months} type="bar" />);
    expect(screen.getByRole("img", { name: /gráfico de barras/ })).not.toBe(bars);
    expect(line).not.toBeInTheDocument();
  });

  it("mantiene identidad del SVG en renders equivalentes y actualizaciones de datos", () => {
    const { rerender } = render(<HomeScreeningChart months={months} type="line" />);
    const chart = screen.getByRole("img", { name: /gráfico de líneas/ });
    const line = chart.querySelector(".ts-chart__line > path");
    const originalPath = line?.getAttribute("d");
    rerender(<HomeScreeningChart months={months.map((month) => ({ ...month }))} type="line" />);
    expect(chart.querySelector(".ts-chart__line > path")).toBe(line);
    const updated = months.map((month) => ({ ...month, total: month.total + 2 }));
    rerender(<HomeScreeningChart months={updated} type="line" />);
    expect(screen.getByRole("img", { name: /gráfico de líneas/ })).toBe(chart);
    expect(chart.querySelector(".ts-chart__line > path")).toBe(line);
    expect(line).toHaveAttribute("pathLength", "1");
    expect(line?.getAttribute("d")).not.toBe(originalPath);
    expect(screen.getByText("19 screenings en los últimos seis meses")).toBeInTheDocument();
  });

  it("termina cada entrada una vez y solo la rearma al cambiar de tipo", () => {
    const { container, rerender } = render(<HomeScreeningChart months={months} type="bar" />);
    for (const type of ["bar", "line", "pie"] as const) {
      rerender(<HomeScreeningChart months={months} type={type} />);
      const root = container.querySelector(".home-chart")!;
      expect(root).toHaveAttribute("data-entering", "true");
      finishAnimation(root, "unrelated-animation");
      expect(root).toHaveAttribute("data-entering", "true");
      if (type === "line") {
        finishAnimation(root, "home-chart-line-enter");
        expect(root).toHaveAttribute("data-entering", "true");
      }
      finishAnimation(root, type === "line" ? "home-chart-point-enter" : `home-chart-${type}-enter`);
      expect(root).toHaveAttribute("data-entering", "false");
      rerender(<HomeScreeningChart months={months.map((month) => ({ ...month }))} type={type} />);
      expect(container.querySelector(".home-chart")).toBe(root);
      expect(root).toHaveAttribute("data-entering", "false");
    }
  });

  it("revela el pastel por arcos y conserva la leyenda y la distribución accesible", () => {
    const { container, rerender } = render(<HomeScreeningChart months={months} type="pie" />);
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-chart-type", "pie");
    expect(screen.getByRole("img", { name: "Distribución mensual de screenings: jul, 4; sep, 9" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gráfico circular" })).toHaveAttribute("tabindex", "0");
    const legend = screen.getByRole("list", { name: "Screenings por mes" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(2);
    expect(within(legend).queryByText("ago")).not.toBeInTheDocument();
    expect(within(legend).getByText("9")).toBeInTheDocument();
    const pie = screen.getByRole("img", { name: "Gráfico circular" });
    rerender(<HomeScreeningChart months={months} type="line" />);
    rerender(<HomeScreeningChart months={months} type="pie" />);
    expect(screen.getByRole("img", { name: "Gráfico circular" })).not.toBe(pie);
  });

  it("usa una máscara angular progresiva sin rotar el SVG y la retira al terminar", () => {
    // jsdom does not paint CSS masks. Guard the visual contract here; the real
    // browser check covers interpolation and the final unmasked SVG.
    const pieRule = chartCss.match(/\.home-chart\[data-entering="true"\]\[data-motion="full"\]\[data-chart-type="pie"\][^{]*\{([^}]+)\}/)?.[1];
    const pieFrames = chartCss.match(/@keyframes home-chart-pie-enter\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(pieRule).toContain("mask-image: conic-gradient(from 0deg");
    expect(pieRule).toContain("500ms ease-out 1 backwards");
    expect(pieFrames).toContain("from { --home-pie-reveal: 0deg; }");
    expect(pieFrames).toContain("to { --home-pie-reveal: 360deg; }");
    expect(pieRule).not.toMatch(/transform|rotate|perspective/);
    expect(pieFrames).not.toMatch(/transform|rotate|perspective/);
    expect(chartCss).toMatch(/@property --home-pie-reveal\s*\{[^}]*syntax: "<angle>";[^}]*initial-value: 360deg;/);
    const { container, rerender } = render(<HomeScreeningChart months={months} type="pie" />);
    const root = container.querySelector(".home-chart")!;
    const svg = screen.getByRole("img", { name: "Gráfico circular" });
    const geometry = [...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(root).toHaveAttribute("data-entering", "true");
    finishAnimation(svg, "home-chart-pie-enter");
    expect(root).toHaveAttribute("data-entering", "false");
    rerender(<HomeScreeningChart months={months.map((month) => ({ ...month }))} type="pie" />);
    expect(screen.getByRole("img", { name: "Gráfico circular" })).toBe(svg);
    expect(root).toHaveAttribute("data-entering", "false");
    expect([...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual(geometry);
  });

  it("permite inspeccionar los datos por teclado y conserva el tooltip", () => {
    const { container } = render(<HomeScreeningChart months={months} type="line" />);
    const chart = screen.getByRole("img", { name: /gráfico de líneas/ });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    const tooltip = document.querySelector(".rc-chart-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Screenings");
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-entering", "false");
    fireEvent.blur(chart);
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-entering", "false");
  });

  it("respeta movimiento reducido inicial y sus cambios en vivo sin reemplazar el gráfico", () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_event: string, callback: () => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const { container, rerender, unmount } = render(<HomeScreeningChart months={months} type="bar" />);
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "reduced");
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-entering", "false");
    rerender(<HomeScreeningChart months={months} type="line" />);
    const chart = screen.getByRole("img", { name: /gráfico de líneas/ });
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "reduced");
    act(() => { media.matches = false; listener?.(); });
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "full");
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-entering", "false");
    act(() => { media.matches = true; listener?.(); });
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByRole("img", { name: /gráfico de líneas/ })).toBe(chart);
    expect(screen.getByText("13 screenings en los últimos seis meses")).toBeInTheDocument();
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("muestra el estado vacío sin animación y entra al recibir datos", () => {
    const { container, rerender } = render(<HomeScreeningChart months={months.map((month) => ({ ...month, total: 0 }))} type="bar" />);
    expect(screen.getByText(/Aún no hay screenings registrados/)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    rerender(<HomeScreeningChart months={months} type="bar" />);
    expect(screen.getByRole("img", { name: /gráfico de barras/ })).toBeInTheDocument();
    expect(container.querySelector(".home-chart")).toHaveAttribute("data-motion", "full");
  });

  it("cancela una entrada activa si se solicita movimiento reducido y no la reinicia al desactivarlo", () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, callback: () => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const { container } = render(<HomeScreeningChart months={months} type="pie" />);
    const root = container.querySelector(".home-chart");
    expect(root).toHaveAttribute("data-entering", "true");
    act(() => { media.matches = true; listener?.(); });
    expect(root).toHaveAttribute("data-motion", "reduced");
    expect(root).toHaveAttribute("data-entering", "false");
    act(() => { media.matches = false; listener?.(); });
    expect(root).toHaveAttribute("data-entering", "false");
    expect(screen.getByRole("list", { name: "Screenings por mes" })).toBeInTheDocument();
  });
});
