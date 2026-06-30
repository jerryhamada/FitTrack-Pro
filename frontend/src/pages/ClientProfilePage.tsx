import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";
import Pill from "../components/ui/Pill";
import OverviewTab from "../components/client/OverviewTab";
import ProgramsTab from "../components/client/ProgramsTab";
import ProgressTab from "../components/client/ProgressTab";
import PRsTab from "../components/client/PRsTab";
import CalendarTab from "../components/client/CalendarTab";
import ExportTab from "../components/client/ExportTab";

const TABS = ["Overview", "Programs", "Progress", "PRs", "Calendar", "Export"] as const;
type Tab = (typeof TABS)[number];

export default function ClientProfilePage() {
  const { clientId } = useParams();
  const id = Number(clientId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => api.clients.get(id),
    enabled: !!id,
  });

  const startSession = useMutation({
    mutationFn: () => api.sessions.start(id),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  const archiveClient = useMutation({
    mutationFn: () => api.clients.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate("/");
    },
  });

  if (isLoading || !client) return <Spinner />;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{client.name}</h1>
            {client.status === "archived" && <Pill tone="danger">Archived</Pill>}
          </div>
          <p className="text-sm text-muted">{client.email}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => startSession.mutate()} disabled={startSession.isPending}>
            {startSession.isPending ? "Starting..." : "Log Session"}
          </button>
          {client.status === "active" && (
            <button className="btn-secondary" onClick={() => archiveClient.mutate()}>
              Archive
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab client={client} />}
      {tab === "Programs" && <ProgramsTab client={client} />}
      {tab === "Progress" && <ProgressTab client={client} />}
      {tab === "PRs" && <PRsTab clientId={id} />}
      {tab === "Calendar" && <CalendarTab clientId={id} />}
      {tab === "Export" && <ExportTab clientId={id} />}

      <p className="mt-8 text-center text-xs text-muted">
        <Link to="/" className="hover:text-white">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
