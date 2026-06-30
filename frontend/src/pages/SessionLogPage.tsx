import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { EffortType, PlannedExercise, SetStatus, Unit } from "../types";
import Spinner from "../components/ui/Spinner";
import Pill from "../components/ui/Pill";
import Stepper from "../components/ui/Stepper";
import RestTimer from "../components/session/RestTimer";
import { formatWeight } from "../lib/utils";

export default function SessionLogPage() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: session, isLoading } = useQuery({ queryKey: ["session", id], queryFn: () => api.sessions.get(id) });
  const { data: client } = useQuery({
    queryKey: ["client", session?.client_id],
    queryFn: () => api.clients.get(session!.client_id),
    enabled: !!session,
  });
  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });

  const [exerciseId, setExerciseId] = useState<number | "">("");
  const [weight, setWeight] = useState(45);
  const [reps, setReps] = useState(10);
  const [unit, setUnit] = useState<Unit>("lbs");
  const [isPerSide, setIsPerSide] = useState(false);
  const [bodyweightOnly, setBodyweightOnly] = useState(false);
  const [effortValue, setEffortValue] = useState<number | "">("");
  const [effortType, setEffortType] = useState<EffortType>("rpe");
  const [modifier, setModifier] = useState("");
  const [status, setStatus] = useState<SetStatus>("completed");
  const [restSignal, setRestSignal] = useState(0);
  const [lastPr, setLastPr] = useState<string | null>(null);

  useEffect(() => {
    if (client) setUnit(client.preferred_unit);
  }, [client]);

  const favorites = useMemo(() => exercises?.filter((e) => e.is_favorite) ?? [], [exercises]);
  const selectedExercise = exercises?.find((e) => e.id === exerciseId);

  function selectPlanned(plan: PlannedExercise) {
    setExerciseId(plan.exercise_id);
    if (plan.target_weight != null) {
      setBodyweightOnly(false);
      setWeight(plan.target_weight);
      setUnit(plan.target_weight_unit ?? client?.preferred_unit ?? "lbs");
    } else {
      setBodyweightOnly(true);
    }
    const targetReps = plan.target_reps ? parseInt(plan.target_reps, 10) : NaN;
    if (!Number.isNaN(targetReps)) setReps(targetReps);
  }

  const logSet = useMutation({
    meta: { skipGlobalToast: true },
    mutationFn: () =>
      api.sessions.logSet(id, {
        exercise_id: exerciseId as number,
        weight: bodyweightOnly ? undefined : weight,
        weight_unit: bodyweightOnly ? undefined : unit,
        is_per_side: bodyweightOnly ? false : isPerSide,
        reps,
        effort_value: effortValue === "" ? undefined : Number(effortValue),
        effort_type: effortValue === "" ? undefined : effortType,
        set_modifier: modifier || undefined,
        status,
      }),
    onSuccess: (set) => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      setRestSignal((s) => s + 1);
      setLastPr(set.is_pr ? (set.pr_type === "estimated_1rm" ? "New estimated 1RM PR!" : "New weight PR!") : null);
      if (set.is_pr) setTimeout(() => setLastPr(null), 4000);
    },
  });

  const deleteSet = useMutation({
    meta: { skipGlobalToast: true },
    mutationFn: (setId: number) => api.sessions.deleteSet(setId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] }),
  });

  const complete = useMutation({
    meta: { skipGlobalToast: true },
    mutationFn: () => api.sessions.complete(id),
    onSuccess: (summary) => navigate(`/sessions/${id}/summary`, { state: { summary } }),
  });

  const cancelSession = useMutation({
    meta: { skipGlobalToast: true },
    mutationFn: () => api.sessions.cancel(id),
    onSuccess: () => navigate(client ? `/clients/${client.id}` : "/"),
  });

  function handleFinish() {
    if (session && session.sets.length === 0) {
      if (!confirm("No sets have been logged yet — finish the session anyway?")) return;
    }
    complete.mutate();
  }

  const activeError = [logSet.error, complete.error, deleteSet.error, cancelSession.error].find(Boolean) as
    | ApiError
    | undefined;

  if (isLoading || !session) return <Spinner />;

  const setsByExercise = session.sets.reduce<Record<string, typeof session.sets>>((acc, s) => {
    (acc[s.exercise_name] ??= []).push(s);
    return acc;
  }, {});

  const weightStep = unit === "lbs" ? 5 : 2.5;

  return (
    <div className="mx-auto max-w-xl pb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{session.label ?? "Session"}</h1>
          <p className="text-sm text-muted">{client?.name}</p>
        </div>
        <div className="flex gap-2">
          {session.sets.length === 0 && (
            <button
              className="btn-secondary !h-10 !px-3 text-sm"
              onClick={() => confirm("Cancel this session? Nothing was logged.") && cancelSession.mutate()}
              disabled={cancelSession.isPending}
            >
              Cancel
            </button>
          )}
          <button className="btn-primary !h-10 !px-4 text-sm" onClick={handleFinish} disabled={complete.isPending}>
            {complete.isPending ? "Finishing..." : "Finish Session"}
          </button>
        </div>
      </div>

      {activeError && (
        <div className="mb-4 rounded-xl border border-danger bg-danger-dim p-3 text-sm text-danger">
          {activeError.message}
          {activeError.isAuthError && (
            <button className="ml-2 font-semibold underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
        </div>
      )}

      {lastPr && (
        <div className="mb-4 rounded-xl border border-accent bg-accent-dim p-3 text-center text-sm font-bold text-accent">
          {lastPr}
        </div>
      )}

      {session.planned_exercises.length > 0 && (
        <div className="card mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Today's Plan</p>
          <div className="flex flex-col gap-1.5">
            {session.planned_exercises.map((plan) => {
              const loggedCount = setsByExercise[plan.exercise_name]?.length ?? 0;
              return (
                <button
                  key={plan.exercise_id}
                  onClick={() => selectPlanned(plan)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                    exerciseId === plan.exercise_id ? "bg-accent-dim" : "bg-bg hover:bg-white/5"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{plan.exercise_name}</p>
                    <p className="text-xs text-muted">
                      {plan.target_sets ?? "?"} x {plan.target_reps ?? "?"}
                      {plan.target_weight ? ` @ ${plan.target_weight}${plan.target_weight_unit ?? ""}` : ""}
                    </p>
                  </div>
                  {plan.target_sets != null && (
                    <Pill tone={loggedCount >= plan.target_sets ? "accent" : "default"}>
                      {loggedCount}/{plan.target_sets} sets
                    </Pill>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pick an exercise</p>
        {favorites.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {favorites.map((e) => (
              <button
                key={e.id}
                onClick={() => setExerciseId(e.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  exerciseId === e.id ? "bg-accent text-black" : "bg-white/5 text-muted"
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
        <select
          className="input-ctrl"
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select exercise...</option>
          {exercises?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {selectedExercise && (
        <div className="card mb-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-white">{selectedExercise.name}</p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Bodyweight / no weight</span>
            <Toggle checked={bodyweightOnly} onChange={setBodyweightOnly} />
          </div>

          {!bodyweightOnly && (
            <>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Weight</p>
                <Stepper value={weight} onChange={setWeight} step={weightStep} min={0} suffix={unit} />
                <div className="mt-2 flex gap-2">
                  <PillToggle label="lbs" active={unit === "lbs"} onClick={() => setUnit("lbs")} />
                  <PillToggle label="kg" active={unit === "kg"} onClick={() => setUnit("kg")} />
                  <PillToggle label="per-side / per-dumbbell" active={isPerSide} onClick={() => setIsPerSide((v) => !v)} />
                </div>
              </div>
            </>
          )}

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Reps</p>
            <Stepper value={reps} onChange={setReps} step={1} min={0} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">RPE/RIR (optional)</span>
              <div className="flex gap-1">
                <input
                  className="input-ctrl !h-10 w-20"
                  type="number"
                  value={effortValue}
                  onChange={(e) => setEffortValue(e.target.value ? Number(e.target.value) : "")}
                />
                <select className="input-ctrl !h-10" value={effortType} onChange={(e) => setEffortType(e.target.value as EffortType)}>
                  <option value="rpe">RPE</option>
                  <option value="rir">RIR</option>
                </select>
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Status</span>
              <select className="input-ctrl !h-10" value={status} onChange={(e) => setStatus(e.target.value as SetStatus)}>
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="skipped">Skipped</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Modifier (e.g. "B60" box-assisted, "k" knee, banded)</span>
            <input className="input-ctrl !h-10" value={modifier} onChange={(e) => setModifier(e.target.value)} />
          </label>

          <button
            className="btn-primary"
            onClick={() => logSet.mutate()}
            disabled={logSet.isPending || exerciseId === ""}
          >
            {logSet.isPending ? "Logging..." : "Log Set"}
          </button>
        </div>
      )}

      <div className="mb-4">
        <RestTimer resetSignal={restSignal} />
      </div>

      <div className="flex flex-col gap-4">
        {Object.entries(setsByExercise).map(([exName, sets]) => (
          <div key={exName} className="card">
            <h3 className="mb-2 text-sm font-semibold text-white">{exName}</h3>
            <div className="flex flex-col gap-1.5">
              {sets.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
                  <span className="text-white">
                    {formatWeight(s.weight, s.weight_unit)}
                    {s.is_per_side ? " /side" : ""} x {s.reps ?? "—"}
                    {s.set_modifier ? ` · ${s.set_modifier}` : ""}
                    {s.status !== "completed" && ` · ${s.status}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {s.is_pr && <Pill tone="accent">PR</Pill>}
                    <button
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-xl text-muted hover:text-danger"
                      onClick={() => deleteSet.mutate(s.id)}
                      aria-label="Delete set"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {session.sets.length === 0 && <p className="text-center text-sm text-muted">No sets logged yet.</p>}
      </div>
    </div>
  );
}

function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-accent text-black" : "bg-white/5 text-muted"}`}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-accent" : "bg-white/10"}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
