import { useMemo } from "react";
import { barY, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import type { DashboardMonth } from "../domain/dashboard";

interface HomeScreeningChartProps {
  months: DashboardMonth[];
  type: HomeChartType;
}

export type HomeChartType = "bar" | "line" | "pie";

const chartColors = ["#456e68", "#eea79e", "#a4d0a1"];

export function HomeScreeningChart({ months, type }: HomeScreeningChartProps) {
  const definition = useMemo(() => defineChart({
    marks: type === "line"
      ? [lineY(months, { x: "label", y: "total", stroke: chartColors[0], strokeWidth: 3, points: true })]
      : [barY(months, { x: "label", y: "total", fill: chartColors[0], radius: 6 })],
    scales: {
      x: { scale: () => type === "line" ? scalePoint().padding(0.5) : scaleBand().padding(0.32) },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    theme: {
      foreground: chartColors[0],
      muted: chartColors[0],
      grid: chartColors[2],
      palette: chartColors,
    },
    tooltip,
    svgAnimation: true,
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
    tooltip,
    svgAnimation: true,
  }), [pieMonths]);
  if (total === 0) {
    return <p className="home-chart-empty">Aún no hay screenings registrados. La evolución mensual aparecerá aquí.</p>;
  }

  return (
    <div className="home-chart">
      {type === "pie" ? <div className="home-pie-chart">
        <div className="home-pie-graphic" role="img" aria-label={`Distribución mensual de screenings: ${pieMonths.map((month) => `${month.label}, ${month.total}`).join("; ")}`}><Chart ariaLabel="Gráfico circular" definition={pieDefinition} height={190} initialWidth={190} /></div>
        <ul className="home-pie-legend" aria-label="Screenings por mes">{pieMonths.map((month, index) => <li key={month.key}><span aria-hidden="true" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span>{month.label}</span><strong>{month.total}</strong></li>)}</ul>
      </div> : <Chart
        ariaLabel={`Screenings creados por mes durante los últimos seis meses, gráfico de ${type === "line" ? "líneas" : "barras"}`}
        definition={definition}
        height={210}
        initialWidth={580}
      />}
      <p>{total} screenings en los últimos seis meses</p>
    </div>
  );
}
