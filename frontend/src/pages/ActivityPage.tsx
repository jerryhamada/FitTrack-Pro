import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import type { ActivityEvent } from "../types";

const LABELS: Record<ActivityEvent["event_type"], string> = {
  session_logged: "Session logged",
  pr_hit: "PR hit",
  invite_sent: "Invite sent",
  invite_accepted: "Invite accepted",
  badge_earned: "Badge earned",
  client_added: "Client added",
};

export default function ActivityPage() {
  const [clientId, setClientId] = useState<number | "">("");

  const { data: clients } = useQuery({ queryKey: ["clients", "active"], queryFn: () => api.clients.list("active") });
  const { data: events, isLoading } = useQuery({
    queryKey: ["activity", clientId],
    queryFn: () => api.activity.list({ client_id: clientId === "" ? undefined : clientId, limit: 100 }),
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Activity</h1>
        <select
          className="input-ctrl !h-10 max-w-[200px]"
          value={clientId}
          onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All clients</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Spinner />}
      {events?.length === 0 && <EmptyState title="No activity yet" subtitle="Sessions, PRs and invites will show up here." />}

      <div className="flex flex-col gap-2">
        {events?.map((e) => (
          <div key={e.id} className="card flex items-center justify-between !p-3">
            <div>
              <p className="text-sm font-medium text-white">{LABELS[e.event_type]}</p>
              <p className="text-xs text-muted">
                {e.client_name && (
                  <>
                    <Link to={`/clients/${e.client_id}`} className="hover:text-accent">
                      {e.client_name}
                    </Link>
                    {" · "}
                  </>
                )}
                {new Date(e.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
