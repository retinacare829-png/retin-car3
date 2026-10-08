import { useMemo } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { DashboardMonth } from "../domain/dashboard";

interface HomeScreeningChartProps {
  months: DashboardMonth[];
}

export function HomeScreeningChart({ months }: HomeScreeningChartProps) {
  const definition = useMemo(() => defineChart({
    marks: [barY(months, { x: "label", y: "total", fill: "#456e68", radius: 6 })],
    scales: {
      x: { scale: () => scaleBand().padding(0.32) },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    theme: {
      foreground: "#456e68",
      muted: "#456e68",
      grid: "#a4d0a1",
      palette: ["#456e68", "#eea79e", "#a4d0a1"],
    },
    tooltip,
    svgAnimation: true,
  }), [months]);

  const total = months.reduce((sum, month) => sum + month.total, 0);
  if (total === 0) {
    return <p className="home-chart-empty">Aún no hay screenings registrados. La evolución mensual aparecerá aquí.</p>;
  }

  return (
    <div className="home-chart">
      <Chart
        ariaLabel="Screenings creados por mes durante los últimos seis meses"
        definition={definition}
        height={210}
        initialWidth={580}
      />
      <p>{total} screenings en los últimos seis meses</p>
    </div>
  );
}
