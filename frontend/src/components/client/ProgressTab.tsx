import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Client } from "../../types";
import Spinner from "../ui/Spinner";
import EmptyState from "../ui/EmptyState";
import ProgressLineChart from "../charts/ProgressLineChart";
import VolumeBarChart from "../charts/VolumeBarChart";

export default function ProgressTab({ client }: { client: Client }) {
  const [exerciseId, setExerciseId] = useState<number | "">("");
  const [metric, setMetric] = useState<"1rm" | "weight">("1rm");

  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", client.id, exerciseId, metric],
    queryFn: () => api.clients.progress(client.id, exerciseId as number, metric),
    enabled: exerciseId !== "",
  });
  const { data: volume, isLoading: volumeLoading } = useQuery({
    queryKey: ["volume-by-category", client.id],
    queryFn: () => api.clients.volumeByCategory(client.id),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="card">
        <h3 className="mb-3 font-semibold text-white">Strength over time</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            className="input-ctrl !h-10 max-w-xs"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select an exercise...</option>
            {exercises?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-border-light">
            {(["1rm", "weight"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-2 text-xs font-semibold ${metric === m ? "bg-accent text-black" : "text-muted"}`}
              >
                {m === "1rm" ? "Est. 1RM" : "Top Weight"}
              </button>
            ))}
          </div>
        </div>
        {exerciseId === "" && <p className="text-sm text-muted">Pick an exercise to chart progress.</p>}
        {exerciseId !== "" && progressLoading && <Spinner />}
        {exerciseId !== "" && progress && progress.points.length === 0 && (
          <EmptyState title="No data yet" subtitle="Log a few sessions with this exercise to see a trend." />
        )}
        {progress && progress.points.length > 0 && <ProgressLineChart points={progress.points} unit={progress.unit} />}
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold text-white">Volume by category (weekly)</h3>
        {volumeLoading && <Spinner />}
        {volume && volume.points.length === 0 && <EmptyState title="No sessions logged yet" />}
        {volume && volume.points.length > 0 && <VolumeBarChart points={volume.points} />}
      </div>
    </div>
  );
}
