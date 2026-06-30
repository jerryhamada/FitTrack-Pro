import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import Spinner from "../ui/Spinner";
import EmptyState from "../ui/EmptyState";
import Pill from "../ui/Pill";
import { formatDate } from "../../lib/utils";

export default function PRsTab({ clientId }: { clientId: number }) {
  const { data: prs, isLoading: prsLoading } = useQuery({
    queryKey: ["prs", clientId],
    queryFn: () => api.clients.prs(clientId),
  });
  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ["badges", clientId],
    queryFn: () => api.clients.badges(clientId),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="card">
        <h3 className="mb-3 font-semibold text-white">Badges earned</h3>
        {badgesLoading && <Spinner />}
        {badges?.length === 0 && <p className="text-sm text-muted">No badges yet.</p>}
        <div className="flex flex-wrap gap-2">
          {badges?.map((b) => (
            <div key={b.badge.code} className="flex flex-col gap-0.5 rounded-xl border border-accent/30 bg-accent-dim px-3 py-2">
              <span className="text-sm font-semibold text-accent">{b.badge.name}</span>
              <span className="text-[11px] text-muted">{formatDate(b.earned_at)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold text-white">PR timeline</h3>
        {prsLoading && <Spinner />}
        {prs?.length === 0 && <EmptyState title="No PRs yet" subtitle="They'll show up automatically as sets are logged." />}
        <div className="flex flex-col gap-2">
          {prs?.map((pr) => (
            <div key={pr.id} className="flex items-center justify-between rounded-xl bg-bg p-3">
              <div>
                <p className="text-sm font-medium text-white">{pr.exercise_name}</p>
                <p className="text-xs text-muted">{formatDate(pr.achieved_at)}</p>
              </div>
              <div className="text-right">
                <Pill tone="accent">{pr.pr_type === "estimated_1rm" ? "Est. 1RM" : "Weight PR"}</Pill>
                <p className="mt-1 text-sm font-semibold text-white">
                  {pr.value.toFixed(1)} {pr.unit}
                  {pr.reps ? ` x ${pr.reps}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
