import "./setup";
import { Bar } from "react-chartjs-2";
import type { VolumeByCategoryPoint } from "../../types";
import { categoryColor } from "../../lib/utils";

export default function VolumeBarChart({ points }: { points: VolumeByCategoryPoint[] }) {
  const weeks = Array.from(new Set(points.map((p) => p.period_start))).sort();
  const categories = Array.from(new Set(points.map((p) => p.category)));

  const datasets = categories.map((category) => ({
    label: category,
    data: weeks.map((w) => points.find((p) => p.period_start === w && p.category === category)?.total_volume ?? 0),
    backgroundColor: categoryColor(category),
  }));

  return (
    <Bar
      data={{ labels: weeks, datasets }}
      options={{
        responsive: true,
        plugins: { legend: { labels: { color: "#9ca3af" } } },
        scales: {
          x: { stacked: true, ticks: { color: "#9ca3af" }, grid: { display: false } },
          y: { stacked: true, ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
        },
      }}
    />
  );
}
