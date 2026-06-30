import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { Client } from "../../types";
import Spinner from "../ui/Spinner";
import EmptyState from "../ui/EmptyState";
import Modal from "../ui/Modal";
import Pill from "../ui/Pill";

export default function ProgramsTab({ client }: { client: Client }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: clientPrograms, isLoading } = useQuery({
    queryKey: ["client-programs", client.id],
    queryFn: () => api.clients.programs(client.id),
  });
  const { data: templates } = useQuery({ queryKey: ["programs"], queryFn: api.programs.list, enabled: assignOpen });

  const assign = useMutation({
    mutationFn: (programId: number) => api.programs.assign(programId, client.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-programs", client.id] });
      setAssignOpen(false);
    },
  });

  const startFromDay = useMutation({
    mutationFn: (vars: { dayId: number; label: string }) =>
      api.sessions.start(client.id, vars.dayId, vars.label),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <button className="btn-secondary self-start" onClick={() => setAssignOpen(true)}>
        + Assign a Program
      </button>

      {clientPrograms?.length === 0 && (
        <EmptyState title="No programs assigned" subtitle="Assign a template or log freeform sessions instead." />
      )}

      {clientPrograms?.map((cp) => (
        <div key={cp.id} className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">{cp.name}</h3>
            {!cp.active && <Pill>Inactive</Pill>}
          </div>
          <div className="flex flex-col gap-3">
            {cp.days.map((day) => (
              <div key={day.id} className="rounded-xl bg-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{day.label}</span>
                  <button
                    className="text-xs font-semibold text-accent"
                    onClick={() => startFromDay.mutate({ dayId: day.id, label: day.label })}
                  >
                    Start Session
                  </button>
                </div>
                <ul className="flex flex-col gap-1">
                  {day.exercises.map((ex) => (
                    <li key={ex.id} className="text-xs text-muted">
                      {ex.exercise_name} — {ex.target_sets ?? "?"} x {ex.target_reps ?? "?"}
                      {ex.target_weight ? ` @ ${ex.target_weight}${ex.target_weight_unit ?? ""}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a Program">
        <div className="flex flex-col gap-2">
          {templates?.length === 0 && <p className="text-sm text-muted">No templates yet — build one first.</p>}
          {templates?.map((t) => (
            <button
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-bg p-3 text-left hover:bg-white/5"
              onClick={() => assign.mutate(t.id)}
              disabled={assign.isPending}
            >
              <span className="text-sm font-medium text-white">{t.name}</span>
              <span className="text-xs text-muted">{t.day_count} days</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
