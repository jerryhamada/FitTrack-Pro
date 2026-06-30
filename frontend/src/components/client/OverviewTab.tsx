import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Client } from "../../types";
import { formatDateTime } from "../../lib/utils";
import Spinner from "../ui/Spinner";

export default function OverviewTab({ client }: { client: Client }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    goals: client.goals ?? "",
    phone: client.phone ?? "",
    preferred_unit: client.preferred_unit,
  });
  const [noteBody, setNoteBody] = useState("");

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ["client-notes", client.id],
    queryFn: () => api.clients.notes(client.id),
  });

  const updateClient = useMutation({
    mutationFn: () => api.clients.update(client.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
    },
  });

  const addNote = useMutation({
    mutationFn: () => api.clients.addNote(client.id, noteBody, true),
    onSuccess: () => {
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["client-notes", client.id] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-white">Goals & details</h3>
          <button className="text-xs font-medium text-accent" onClick={() => setEditing((e) => !e)}>
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {!editing ? (
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Goals" value={client.goals || "—"} />
            <Row label="Phone" value={client.phone || "—"} />
            <Row label="Preferred unit" value={client.preferred_unit} />
            <Row
              label="Starting stats"
              value={
                client.starting_bodyweight || client.starting_body_fat_pct
                  ? `${client.starting_bodyweight ?? "—"} ${client.preferred_unit}, ${client.starting_body_fat_pct ?? "—"}% BF`
                  : "—"
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              className="input-ctrl"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
            />
            <textarea
              className="input-ctrl !h-20 resize-none py-3"
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="Goals"
            />
            <input
              className="input-ctrl"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
            />
            <select
              className="input-ctrl"
              value={form.preferred_unit}
              onChange={(e) => setForm({ ...form, preferred_unit: e.target.value as "lbs" | "kg" })}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
            <button className="btn-primary" onClick={() => updateClient.mutate()} disabled={updateClient.isPending}>
              Save changes
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold text-white">Trainer notes</h3>
        <p className="mb-3 text-xs text-muted">Private — never visible to the client.</p>
        <div className="mb-3 flex gap-2">
          <input
            className="input-ctrl"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note..."
            onKeyDown={(e) => e.key === "Enter" && noteBody.trim() && addNote.mutate()}
          />
          <button className="btn-secondary" disabled={!noteBody.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
            Add
          </button>
        </div>
        {notesLoading && <Spinner />}
        <div className="flex flex-col gap-3">
          {notes?.map((n) => (
            <div key={n.id} className="rounded-xl bg-bg p-3">
              <p className="text-sm text-white">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted">{formatDateTime(n.created_at)}</p>
            </div>
          ))}
          {notes?.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}
