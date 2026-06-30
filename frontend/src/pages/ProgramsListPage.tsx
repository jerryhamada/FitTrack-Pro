import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { formatDate } from "../lib/utils";

export default function ProgramsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [assignProgramId, setAssignProgramId] = useState<number | null>(null);

  const { data: programs, isLoading } = useQuery({ queryKey: ["programs"], queryFn: api.programs.list });
  const { data: clients } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
    enabled: assignProgramId !== null,
  });

  const deleteProgram = useMutation({
    mutationFn: (id: number) => api.programs.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programs"] }),
  });
  const assign = useMutation({
    mutationFn: (clientId: number) => api.programs.assign(assignProgramId!, clientId),
    onSuccess: (_, clientId) => {
      setAssignProgramId(null);
      navigate(`/clients/${clientId}`);
    },
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Programs</h1>
        <Link to="/programs/new" className="btn-primary">
          + New Program
        </Link>
      </div>

      {isLoading && <Spinner />}
      {programs?.length === 0 && (
        <EmptyState
          title="No program templates yet"
          subtitle="Build a reusable weekly plan you can assign to any client."
          action={
            <Link to="/programs/new" className="btn-primary mt-2">
              + New Program
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {programs?.map((p) => (
          <div key={p.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{p.name}</p>
              <p className="text-xs text-muted">
                {p.day_count} days · created {formatDate(p.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !h-9 !px-3 text-xs" onClick={() => setAssignProgramId(p.id)}>
                Assign
              </button>
              <Link to={`/programs/${p.id}/edit`} className="btn-secondary !h-9 !px-3 text-xs">
                Edit
              </Link>
              <button
                className="!h-9 rounded-xl border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger-dim"
                onClick={() => confirm(`Delete "${p.name}"?`) && deleteProgram.mutate(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={assignProgramId !== null} onClose={() => setAssignProgramId(null)} title="Assign to Client">
        <div className="flex flex-col gap-2">
          {clients?.length === 0 && <p className="text-sm text-muted">No active clients yet.</p>}
          {clients?.map((c) => (
            <button
              key={c.id}
              className="rounded-xl bg-bg p-3 text-left text-sm font-medium text-white hover:bg-white/5"
              onClick={() => assign.mutate(c.id)}
              disabled={assign.isPending}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
