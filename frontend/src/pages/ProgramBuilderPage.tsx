import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Unit } from "../types";
import Spinner from "../components/ui/Spinner";

interface BuilderExercise {
  exercise_id: number | "";
  order_index: number;
  target_sets?: number;
  target_reps?: string;
  target_weight?: number;
  target_weight_unit?: Unit;
  target_rpe?: number;
  target_rest_seconds?: number;
  notes?: string;
}
interface BuilderDay {
  label: string;
  order_index: number;
  exercises: BuilderExercise[];
}

export default function ProgramBuilderPage() {
  const { programId } = useParams();
  const isEdit = !!programId;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<BuilderDay[]>([{ label: "Day 1", order_index: 0, exercises: [] }]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.programs.get(Number(programId)),
    enabled: isEdit,
  });
  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setDays(
        existing.days.map((d) => ({
          label: d.label,
          order_index: d.order_index,
          exercises: d.exercises.map((e) => ({
            exercise_id: e.exercise_id,
            order_index: e.order_index,
            target_sets: e.target_sets ?? undefined,
            target_reps: e.target_reps ?? undefined,
            target_weight: e.target_weight ?? undefined,
            target_weight_unit: e.target_weight_unit ?? undefined,
            target_rpe: e.target_rpe ?? undefined,
            target_rest_seconds: e.target_rest_seconds ?? undefined,
            notes: e.notes ?? undefined,
          })),
        }))
      );
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        days: days.map((d, i) => ({
          ...d,
          order_index: i,
          exercises: d.exercises
            .filter((e) => e.exercise_id !== "")
            .map((e, j) => ({ ...e, order_index: j, exercise_id: e.exercise_id as number })),
        })),
      };
      return isEdit ? api.programs.update(Number(programId), payload) : api.programs.create(payload);
    },
    onSuccess: () => navigate("/programs"),
  });

  function addDay() {
    setDays((d) => [...d, { label: `Day ${d.length + 1}`, order_index: d.length, exercises: [] }]);
  }
  function removeDay(i: number) {
    setDays((d) => d.filter((_, idx) => idx !== i));
  }
  function addExercise(dayIdx: number) {
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx ? { ...day, exercises: [...day.exercises, { exercise_id: "", order_index: day.exercises.length }] } : day
      )
    );
  }
  function updateExercise(dayIdx: number, exIdx: number, patch: Partial<BuilderExercise>) {
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx
          ? { ...day, exercises: day.exercises.map((e, j) => (j === exIdx ? { ...e, ...patch } : e)) }
          : day
      )
    );
  }
  function removeExercise(dayIdx: number, exIdx: number) {
    setDays((d) =>
      d.map((day, idx) => (idx === dayIdx ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIdx) } : day))
    );
  }

  if (isEdit && isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-white">{isEdit ? "Edit Program" : "New Program"}</h1>

      <div className="mb-5 flex flex-col gap-3">
        <input className="input-ctrl" placeholder="Program name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          className="input-ctrl !h-20 resize-none py-3"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4">
        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="card">
            <div className="mb-3 flex items-center gap-2">
              <input
                className="input-ctrl !h-10 flex-1"
                value={day.label}
                onChange={(e) =>
                  setDays((d) => d.map((dd, i) => (i === dayIdx ? { ...dd, label: e.target.value } : dd)))
                }
              />
              {days.length > 1 && (
                <button className="text-xs font-medium text-danger" onClick={() => removeDay(dayIdx)}>
                  Remove day
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {day.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="rounded-xl bg-bg p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      className="input-ctrl !h-10 flex-1"
                      value={ex.exercise_id}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { exercise_id: Number(e.target.value) })}
                    >
                      <option value="">Select exercise...</option>
                      {exercises?.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <button className="text-lg text-danger" onClick={() => removeExercise(dayIdx, exIdx)}>
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="input-ctrl !h-10"
                      type="number"
                      placeholder="Sets"
                      value={ex.target_sets ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { target_sets: e.target.value ? Number(e.target.value) : undefined })}
                    />
                    <input
                      className="input-ctrl !h-10"
                      placeholder="Reps (e.g. 8-12)"
                      value={ex.target_reps ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { target_reps: e.target.value || undefined })}
                    />
                    <input
                      className="input-ctrl !h-10"
                      type="number"
                      placeholder="Rest (sec)"
                      value={ex.target_rest_seconds ?? ""}
                      onChange={(e) =>
                        updateExercise(dayIdx, exIdx, { target_rest_seconds: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <input
                      className="input-ctrl !h-10"
                      type="number"
                      placeholder="Target weight"
                      value={ex.target_weight ?? ""}
                      onChange={(e) =>
                        updateExercise(dayIdx, exIdx, { target_weight: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <select
                      className="input-ctrl !h-10"
                      value={ex.target_weight_unit ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { target_weight_unit: (e.target.value || undefined) as Unit | undefined })}
                    >
                      <option value="">unit</option>
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                    <input
                      className="input-ctrl !h-10"
                      type="number"
                      placeholder="Target RPE"
                      value={ex.target_rpe ?? ""}
                      onChange={(e) => updateExercise(dayIdx, exIdx, { target_rpe: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>
              ))}
              <button className="text-xs font-semibold text-accent" onClick={() => addExercise(dayIdx)}>
                + Add Exercise
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-secondary mt-4" onClick={addDay}>
        + Add Day
      </button>

      <div className="mt-6 flex gap-2">
        <button className="btn-primary flex-1" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving..." : "Save Program"}
        </button>
        <button className="btn-secondary" onClick={() => navigate("/programs")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
