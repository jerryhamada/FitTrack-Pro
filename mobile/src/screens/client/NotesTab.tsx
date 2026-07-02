import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import EmptyState from "../../components/EmptyState";
import Pill from "../../components/Pill";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { colors, font, radius, spacing } from "../../theme";
import type { NoteCategory } from "../../types";

const CATEGORIES: { key: NoteCategory; label: string }[] = [
  { key: "technique", label: "Technique" },
  { key: "injury", label: "Injury" },
  { key: "mobility", label: "Mobility" },
  { key: "nutrition", label: "Nutrition" },
  { key: "homework", label: "Homework" },
  { key: "preferences", label: "Preferences" },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<
  NoteCategory,
  string
>;

export default function NotesTab({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<NoteCategory | null>(null);
  const [filter, setFilter] = useState<NoteCategory | "all">("all");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: () => api.clients.notes(clientId),
  });

  const addNote = useMutation({
    mutationFn: () => api.clients.addNote(clientId, body.trim(), true, category ?? undefined),
    onSuccess: () => {
      setBody("");
      setCategory(null);
      qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
    },
  });

  const filtered = useMemo(() => {
    if (filter === "all") return notes ?? [];
    return (notes ?? []).filter((n) => n.category === filter);
  }, [notes, filter]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.composer}>
        <Text style={styles.hint}>Private — never visible to the client.</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.field}
            value={body}
            onChangeText={setBody}
            placeholder="Add a note..."
            placeholderTextColor={colors.muted}
            multiline
          />
          <TouchableOpacity
            style={[styles.addBtn, (!body.trim() || addNote.isPending) && { opacity: 0.4 }]}
            onPress={() => body.trim() && addNote.mutate()}
            disabled={!body.trim() || addNote.isPending}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catChip, category === c.key && styles.catChipActive]}
              onPress={() => setCategory(category === c.key ? null : c.key)}
            >
              <Text style={[styles.catChipText, category === c.key && { color: "#000" }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.catChip, filter === "all" && styles.catChipActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.catChipText, filter === "all" && { color: "#000" }]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catChip, filter === c.key && styles.catChipActive]}
            onPress={() => setFilter(filter === c.key ? "all" : c.key)}
          >
            <Text style={[styles.catChipText, filter === c.key && { color: "#000" }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title={filter === "all" ? "No notes yet" : "No notes in this category"}
              subtitle={
                filter === "all"
                  ? "Technique cues, injuries, homework — anything worth remembering."
                  : "Notes tagged with this category will show up here."
              }
            />
          }
          renderItem={({ item }) => (
            <View style={styles.note}>
              <View style={styles.noteTop}>
                {item.category ? (
                  <Pill tone="accent">{CATEGORY_LABELS[item.category]}</Pill>
                ) : (
                  <View />
                )}
                <Text style={styles.noteDate}>{formatDateTime(item.created_at)}</Text>
              </View>
              <Text style={styles.noteBody}>{item.body}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    padding: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hint: { fontSize: font.xs, color: colors.muted },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  field: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.base,
    justifyContent: "center",
  },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: font.sm },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  catChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  catChipActive: { backgroundColor: colors.accent },
  catChipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl, gap: spacing.sm },
  note: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
  },
  noteTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  noteBody: { fontSize: font.sm, color: colors.white, lineHeight: 20 },
  noteDate: { fontSize: font.xs, color: colors.muted },
});
