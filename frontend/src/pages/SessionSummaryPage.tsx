import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SessionSummary, WorkoutSession } from "../types";
import Spinner from "../components/ui/Spinner";
import StatCard from "../components/ui/StatCard";
import Pill from "../components/ui/Pill";
import { formatDuration, formatWeight } from "../lib/utils";

export default function SessionSummaryPage() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const navigate = useNavigate();
  const location = useLocation();
  const passedSummary = (location.state as { summary?: SessionSummary } | null)?.summary;

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => api.sessions.get(id),
    enabled: !passedSummary,
  });

  if (!passedSummary && isLoading) return <Spinner />;

  const summary: SessionSummary = passedSummary ?? deriveSummary(session!);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-white">Session Complete</h1>
      <p className="mb-6 text-sm text-muted">Nice work — here's how it went.</p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Total Volume" value={`${Math.round(summary.total_volume).toLocaleString()} ${summary.total_volume_unit}`} accent />
        <StatCard label="Sets Completed" value={String(summary.total_sets)} />
        <StatCard label="Duration" value={formatDuration(summary.duration_seconds)} />
        <StatCard label="PRs Hit" value={String(summary.prs_hit.length)} accent={summary.prs_hit.length > 0} />
      </div>

      {summary.prs_hit.length > 0 && (
        <div className="card mb-6">
          <h3 className="mb-3 font-semibold text-white">PRs hit this session</h3>
          <div className="flex flex-col gap-2">
            {summary.prs_hit.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
                <span className="text-white">{s.exercise_name}</span>
                <div className="flex items-center gap-2">
                  <Pill tone="accent">{s.pr_type === "estimated_1rm" ? "Est. 1RM" : "Weight PR"}</Pill>
                  <span className="text-muted">
                    {formatWeight(s.weight, s.weight_unit)} x {s.reps}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => navigate(`/clients/${session?.client_id ?? ""}`)}>
          Back to Client
        </button>
        <button className="btn-secondary" onClick={() => navigate("/")}>
          Dashboard
        </button>
      </div>
    </div>
  );
}

function deriveSummary(session: WorkoutSession): SessionSummary {
  const sets = session.sets;
  const prs = sets.filter((s) => s.is_pr);
  const unit = sets.find((s) => s.weight_unit)?.weight_unit ?? "lbs";
  const totalVolume = sets.reduce((sum, s) => {
    if (s.status === "skipped" || s.weight == null || !s.reps) return sum;
    const load = s.is_per_side ? s.weight * 2 : s.weight;
    return sum + load * s.reps;
  }, 0);
  return {
    session_id: session.id,
    total_volume: totalVolume,
    total_volume_unit: unit,
    total_sets: sets.length,
    duration_seconds: session.duration_seconds,
    prs_hit: prs,
  };
}
