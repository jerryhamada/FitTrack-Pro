import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Btn from "../../components/Btn";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import type { Client } from "../../types";
import { colors, font, radius, spacing } from "../../theme";

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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Goals & details</Text>
          <TouchableOpacity onPress={() => setEditing((e) => !e)}>
            <Text style={styles.editBtn}>{editing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>
        {!editing ? (
          <View style={styles.rows}>
            <Row label="Goals" value={client.goals || "—"} />
            <Row label="Phone" value={client.phone || "—"} />
            <Row label="Unit" value={client.preferred_unit} />
            <Row
              label="Starting stats"
              value={
                client.starting_bodyweight || client.starting_body_fat_pct
                  ? `${client.starting_bodyweight ?? "—"} ${client.preferred_unit}, ${client.starting_body_fat_pct ?? "—"}% BF`
                  : "—"
              }
            />
          </View>
        ) : (
          <View style={styles.editFields}>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              placeholder="Name"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={form.goals}
              onChangeText={(v) => setForm({ ...form, goals: v })}
              placeholder="Goals"
              placeholderTextColor={colors.muted}
              multiline
            />
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              placeholder="Phone"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.unitRow}>
              {(["lbs", "kg"] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, form.preferred_unit === u && styles.unitBtnActive]}
                  onPress={() => setForm({ ...form, preferred_unit: u })}
                >
                  <Text style={[styles.unitBtnText, form.preferred_unit === u && { color: "#000" }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Btn label="Save changes" onPress={() => updateClient.mutate()} loading={updateClient.isPending} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trainer notes</Text>
        <Text style={styles.notesHint}>Private — never visible to the client.</Text>
        <View style={styles.noteInput}>
          <TextInput
            style={styles.noteField}
            value={noteBody}
            onChangeText={setNoteBody}
            placeholder="Add a note..."
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity
            style={[styles.addNoteBtn, (!noteBody.trim() || addNote.isPending) && { opacity: 0.4 }]}
            onPress={() => noteBody.trim() && addNote.mutate()}
            disabled={!noteBody.trim() || addNote.isPending}
          >
            <Text style={styles.addNoteBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {notesLoading && <Spinner />}
        <View style={styles.notesList}>
          {notes?.map((n) => (
            <View key={n.id} style={styles.noteItem}>
              <Text style={styles.noteBody}>{n.body}</Text>
              <Text style={styles.noteDate}>{formatDateTime(n.created_at)}</Text>
            </View>
          ))}
          {notes?.length === 0 && <Text style={styles.muted}>No notes yet.</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.base },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  editBtn: { fontSize: font.sm, color: colors.accent, fontWeight: "500" },
  rows: { gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.base },
  rowLabel: { fontSize: font.sm, color: colors.muted },
  rowValue: { fontSize: font.sm, color: colors.white, textAlign: "right", flex: 1 },
  editFields: { gap: spacing.sm },
  input: {
    height: 44,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: font.sm,
  },
  unitRow: { flexDirection: "row", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  unitBtn: { flex: 1, padding: spacing.sm, alignItems: "center" },
  unitBtnActive: { backgroundColor: colors.accent },
  unitBtnText: { fontWeight: "600", fontSize: font.sm, color: colors.muted },
  notesHint: { fontSize: font.xs, color: colors.muted },
  noteInput: { flexDirection: "row", gap: spacing.sm },
  noteField: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  addNoteBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  addNoteBtnText: { color: colors.white, fontWeight: "600", fontSize: font.sm },
  notesList: { gap: spacing.sm },
  noteItem: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  noteBody: { fontSize: font.sm, color: colors.white },
  noteDate: { fontSize: font.xs, color: colors.muted, marginTop: 4 },
  muted: { fontSize: font.sm, color: colors.muted },
});
