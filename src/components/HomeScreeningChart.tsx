import { useMemo } from "react";
import { barY, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
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
  if (total === 0) {
    return <p className="home-chart-empty">Aún no hay screenings registrados. La evolución mensual aparecerá aquí.</p>;
  }

  const pieMonths = months.filter((month) => month.total > 0);
  let accumulated = 0;
  const pieSegments = pieMonths.map((month, index) => {
    const start = accumulated;
    accumulated += month.total / total * 360;
    return `${chartColors[index % chartColors.length]} ${start}deg ${accumulated}deg`;
  });

  return (
    <div className="home-chart">
      {type === "pie" ? <div className="home-pie-chart">
        <div className="home-pie-graphic" role="img" aria-label={`Distribución mensual de screenings: ${pieMonths.map((month) => `${month.label}, ${month.total}`).join("; ")}`} style={{ background: `conic-gradient(${pieSegments.join(", ")})` }} />
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
