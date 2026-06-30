import "./setup";
import { Line } from "react-chartjs-2";
import type { ProgressPoint } from "../../types";

export default function ProgressLineChart({ points, unit }: { points: ProgressPoint[]; unit: string }) {
  return (
    <Line
      data={{
        labels: points.map((p) => p.date),
        datasets: [
          {
            label: unit,
            data: points.map((p) => p.value),
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
          y: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
        },
      }}
    />
  );
}
