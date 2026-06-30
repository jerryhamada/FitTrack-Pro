import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import Pill from "../components/ui/Pill";
import { daysAgo, formatDate } from "../lib/utils";

export default function DashboardPage() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-muted">Your roster at a glance.</p>
        </div>
        <Link to="/clients/new" className="btn-primary flex items-center">
          + Add Client
        </Link>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && clients?.length === 0 && (
        <EmptyState
          title="No clients yet"
          subtitle="Add your first client to start building programs and logging sessions."
          action={
            <Link to="/clients/new" className="btn-primary mt-2">
              + Add Client
            </Link>
          }
        />
      )}

      {!isLoading && clients && clients.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const last = daysAgo(c.last_session_at);
            return (
              <Link
                key={c.id}
                to={`/clients/${c.id}`}
                className="card flex flex-col gap-3 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{c.name}</p>
                    <p className="text-xs text-muted">{c.email}</p>
                  </div>
                  {c.is_stale && <Pill tone="danger">Needs a check-in</Pill>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    Last session: {c.last_session_at ? `${last}d ago` : "never"}
                  </span>
                  <span className="font-medium text-white">{c.sessions_this_week} this week</span>
                </div>
                {c.recent_pr_label && (
                  <div className="flex items-center gap-1 text-xs">
                    <Pill tone="accent">PR</Pill>
                    <span className="text-muted">{c.recent_pr_label}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted">Client since {formatDate(c.created_at)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
