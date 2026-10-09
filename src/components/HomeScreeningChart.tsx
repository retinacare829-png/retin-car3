import { useEffect, useMemo, useState, type ReactNode } from "react";
import { barY, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import type { DashboardMonth } from "../domain/dashboard";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./HomeScreeningChart.css";

interface HomeScreeningChartProps {
  months: DashboardMonth[];
  type: HomeChartType;
}

export type HomeChartType = "bar" | "line" | "pie";

const chartColors = ["#456e68", "#a3cfa0", "#eda69d", "#2b4741", "#e8c56a", "#5f706d"];
const chartTooltip = {
  use: tooltip,
  className: "rc-chart-tooltip",
  content: (points: readonly { datum: DashboardMonth }[]) => ({
    title: points[0]?.datum.label ?? "Actividad",
    rows: points.map(({ datum }) => ({ label: "Screenings", value: String(datum.total), color: chartColors[0] })),
  }),
};

// Normalize the authored line, not axes or focus rings. The SVG still belongs
// to TanStack; onRender reapplies this attribute after its keyed reconciliation.
function prepareLineReveal({ svg }: { svg: SVGSVGElement }) {
  svg.querySelectorAll<SVGPathElement>(".ts-chart__line > path").forEach((path) => {
    path.setAttribute("pathLength", "1");
  });
}

function ChartEntrance({ type, reducedMotion, children }: { type: HomeChartType; reducedMotion: boolean; children: ReactNode }) {
  const [entering, setEntering] = useState(!reducedMotion);
  useEffect(() => {
    if (reducedMotion) setEntering(false);
  }, [reducedMotion]);
  const finalAnimation = type === "line" ? "home-chart-point-enter" : `home-chart-${type}-enter`;
  return <div
    className="home-chart"
    data-chart-type={type}
    data-motion={reducedMotion ? "reduced" : "full"}
    data-entering={entering}
    onAnimationEnd={(event) => { if (event.animationName === finalAnimation) setEntering(false); }}
    onFocusCapture={() => setEntering(false)}
  >{children}</div>;
}

export function HomeScreeningChart({ months, type }: HomeScreeningChartProps) {
  const reducedMotion = useReducedMotion();
  const definition = useMemo(() => defineChart({
    marks: type === "line"
      ? [lineY(months, { x: "label", y: "total", key: "key", stroke: chartColors[0], strokeWidth: 3, points: true })]
      : [barY(months, { x: "label", y: "total", key: "key", fill: chartColors[0], radius: 6 })],
    scales: {
      x: { scale: () => type === "line" ? scalePoint().padding(0.5) : scaleBand().padding(0.32) },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    theme: {
      foreground: chartColors[0],
      muted: "#5f706d",
      grid: "#edf1f0",
      palette: chartColors,
    },
    tooltip: chartTooltip,
    // CSS owns the entrance; avoid a second clock changing SVG geometry.
    svgAnimation: false,
  }), [months, type]);

  const total = months.reduce((sum, month) => sum + month.total, 0);
  const pieMonths = useMemo(() => months.filter((month) => month.total > 0), [months]);
  const pieDefinition = useMemo(() => defineChart({
    marks: [polar({
      inset: 8,
      marks: [radialArc(pie(pieMonths, { value: "total" }), { key: "key", color: "key", innerRadius: ({ radius }) => radius * 0.52, cornerRadius: 3 })],
      scales: { angle: null, radius: null },
    })],
    scales: { x: null, y: null },
    color: { domain: pieMonths.map((month) => month.key), range: pieMonths.map((_, index) => chartColors[index % chartColors.length] ?? chartColors[0] ?? "#456e68") },
    theme: { foreground: "#16241f", muted: "#5f706d", background: "#fff", palette: chartColors },
    tooltip: chartTooltip,
    svgAnimation: false,
  }), [pieMonths]);
  if (total === 0) {
    return <p className="home-chart-empty">Aún no hay screenings registrados. La evolución mensual aparecerá aquí.</p>;
  }

  return (
    <ChartEntrance key={type} type={type} reducedMotion={reducedMotion}>
      {type === "pie" ? <div className="home-pie-chart">
        <div className="home-pie-graphic" role="img" aria-label={`Distribución mensual de screenings: ${pieMonths.map((month) => `${month.label}, ${month.total}`).join("; ")}`}><Chart ariaLabel="Gráfico circular" definition={pieDefinition} height={190} initialWidth={190} /></div>
        <ul className="home-pie-legend" aria-label="Screenings por mes">{pieMonths.map((month, index) => <li key={month.key}><span aria-hidden="true" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span>{month.label}</span><strong>{month.total}</strong></li>)}</ul>
      </div> : <Chart
        ariaLabel={`Screenings creados por mes durante los últimos seis meses, gráfico de ${type === "line" ? "líneas" : "barras"}`}
        definition={definition}
        onRender={type === "line" ? prepareLineReveal : undefined}
        height={210}
        initialWidth={580}
      />}
      <p>{total} screenings en los últimos seis meses</p>
      {type !== "pie" ? <ul className="sr-only" aria-label="Datos del gráfico">{months.map((month) => <li key={month.key}>{month.label}: {month.total} screenings</li>)}</ul> : null}
    </ChartEntrance>
  );
}
