import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";
import Modal from "../components/ui/Modal";
import Pill from "../components/ui/Pill";
import EmptyState from "../components/ui/EmptyState";

const CATEGORIES = ["Lower Body", "Upper Body — Compound Push", "Upper Body — Compound Pull"];

export default function ExerciseLibraryPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string | "">("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], subcategory: "", notes: "" });

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises", category, favoritesOnly],
    queryFn: () => api.exercises.list({ category: category || undefined, favorites_only: favoritesOnly }),
  });

  const toggleFavorite = useMutation({
    mutationFn: (vars: { id: number; isFavorite: boolean }) =>
      vars.isFavorite ? api.exercises.unfavorite(vars.id) : api.exercises.favorite(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });

  const createExercise = useMutation({
    mutationFn: () => api.exercises.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      setAddOpen(false);
      setForm({ name: "", category: CATEGORIES[0], subcategory: "", notes: "" });
    },
  });

  const filtered = exercises?.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered?.reduce<Record<string, typeof filtered>>((acc, e) => {
    const key = e.subcategory ?? "Other";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Exercise Library</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Add Exercise
        </button>
      </div>

      <input
        className="input-ctrl mb-3"
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === "" ? "bg-accent text-black" : "bg-white/5 text-muted"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === c ? "bg-accent text-black" : "bg-white/5 text-muted"}`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setFavoritesOnly((f) => !f)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${favoritesOnly ? "bg-accent text-black" : "bg-white/5 text-muted"}`}
        >
          ★ Favorites
        </button>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && grouped && Object.keys(grouped).length === 0 && (
        <EmptyState
          title="No exercises match"
          subtitle={
            favoritesOnly
              ? "You haven't favorited any exercises yet — tap the star on an exercise to pin it here."
              : "Try a different search term or category."
          }
        />
      )}

      {grouped &&
        Object.entries(grouped).map(([sub, items]) => (
          <div key={sub} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{sub}</h3>
            <div className="flex flex-col gap-1.5">
              {items!.map((e) => (
                <div key={e.id} className="card flex items-center justify-between !p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{e.name}</p>
                    {e.notes && <p className="text-xs text-muted">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {e.is_custom && <Pill>Custom</Pill>}
                    <button
                      onClick={() => toggleFavorite.mutate({ id: e.id, isFavorite: e.is_favorite })}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center text-xl ${e.is_favorite ? "text-accent" : "text-muted"}`}
                      aria-label="favorite"
                    >
                      {e.is_favorite ? "★" : "☆"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Custom Exercise">
        <div className="flex flex-col gap-3">
          <input
            className="input-ctrl"
            placeholder="Exercise name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="input-ctrl"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="input-ctrl"
            placeholder="Subcategory (e.g. Squat pattern)"
            value={form.subcategory}
            onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
          />
          <textarea
            className="input-ctrl !h-20 resize-none py-3"
            placeholder="Notes / cues (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button
            className="btn-primary"
            disabled={!form.name.trim() || createExercise.isPending}
            onClick={() => createExercise.mutate()}
          >
            Add Exercise
          </button>
        </div>
      </Modal>
    </div>
  );
}
