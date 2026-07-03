import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import BodyDiagram from "../components/BodyDiagram";
import { api } from "../lib/api";
import { MUSCLE_LABELS, MUSCLE_REGIONS, type MuscleRegion } from "../lib/muscles";
import type { Exercise } from "../types";
import { colors, font, radius, spacing } from "../theme";

const MUSCLE_GROUPS: { title: string; muscles: string[] }[] = [
  { title: "Upper Body", muscles: ["chest", "back", "shoulders", "biceps", "triceps", "forearms"] },
  { title: "Lower Body", muscles: ["quads", "hamstrings", "glutes", "calves"] },
  { title: "Core", muscles: ["core"] },
];
const ALL_MUSCLES = MUSCLE_GROUPS.flatMap((g) => g.muscles);

// Narrow a stored muscle string to a known region (or null if unrecognized).
function asRegion(m: string | null | undefined): MuscleRegion | null {
  return m && (MUSCLE_REGIONS as readonly string[]).includes(m) ? (m as MuscleRegion) : null;
}
const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "band", "sled", "kettlebell"];

// The DB requires a coarse category — derive it from the primary muscle so the
// add/edit form only asks for muscles.
function categoryForMuscle(muscle: string): string {
  if (["chest", "shoulders", "triceps"].includes(muscle)) return "Upper Body — Compound Push";
  if (["back", "biceps", "forearms"].includes(muscle)) return "Upper Body — Compound Pull";
  if (muscle === "core") return "Core";
  return "Lower Body";
}

interface FormState {
  name: string;
  muscle_group: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  exercise_type: "compound" | "isolation" | null;
  steps: string; // one step per line; split into instructions_steps on save
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  muscle_group: null,
  secondary_muscles: [],
  equipment: null,
  exercise_type: null,
  steps: "",
  notes: "",
};

export default function ExerciseLibraryScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.exercises.list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["exercises"] });

  const toggleFavorite = useMutation({
    mutationFn: (vars: { id: number; isFavorite: boolean }) =>
      vars.isFavorite ? api.exercises.unfavorite(vars.id) : api.exercises.favorite(vars.id),
    onSuccess: invalidate,
  });

  const saveExercise = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        category: categoryForMuscle(form.muscle_group!),
        muscle_group: form.muscle_group,
        secondary_muscles: form.secondary_muscles.length > 0 ? form.secondary_muscles : null,
        equipment: form.equipment,
        exercise_type: form.exercise_type,
        instructions_steps: (() => {
          const steps = form.steps.split("\n").map((l) => l.trim()).filter(Boolean);
          return steps.length > 0 ? steps : null;
        })(),
        notes: form.notes.trim() || null,
      };
      return editingId != null ? api.exercises.update(editingId, body) : api.exercises.create(body);
    },
    onSuccess: (saved) => {
      invalidate();
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      if (detail && saved.id === detail.id) setDetail(saved);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const deleteExercise = useMutation({
    mutationFn: (id: number) => api.exercises.delete(id),
    onSuccess: () => {
      invalidate();
      setDetail(null);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const visible = useMemo(() => {
    let list = exercises ?? [];
    if (favoritesOnly) list = list.filter((e) => e.is_favorite);
    return list;
  }, [exercises, favoritesOnly]);

  // Search: name matches first, muscle-group matches second.
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return null;
    const byName = visible.filter((e) => e.name.toLowerCase().includes(q));
    const byMuscle = visible.filter(
      (e) => !byName.includes(e) && (e.muscle_group ?? "").toLowerCase().includes(q)
    );
    return [...byName, ...byMuscle];
  }, [visible, q]);

  const byMuscle = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of visible) {
      const key = e.muscle_group && ALL_MUSCLES.includes(e.muscle_group) ? e.muscle_group : "other";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [visible]);

  const toggleSection = (muscle: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(muscle)) next.delete(muscle);
      else next.add(muscle);
      return next;
    });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (e: Exercise) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      muscle_group: e.muscle_group,
      secondary_muscles: e.secondary_muscles ?? [],
      equipment: e.equipment,
      exercise_type: e.exercise_type,
      steps: (e.instructions_steps ?? []).join("\n"),
      notes: e.notes ?? "",
    });
    setDetail(null);
    setFormOpen(true);
  };

  const confirmDelete = (e: Exercise) =>
    Alert.alert(
      "Delete exercise",
      `Delete "${e.name}"? If it appears in any workout history it will be hidden from future selection instead (history stays intact).`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteExercise.mutate(e.id) },
      ]
    );

  const Row = ({ e }: { e: Exercise }) => (
    <TouchableOpacity style={styles.row} onPress={() => setDetail(e)} activeOpacity={0.75}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowName}>{e.name}</Text>
        <View style={styles.rowTags}>
          {e.muscle_group && <Pill>{e.muscle_group}</Pill>}
          {e.equipment && <Pill>{e.equipment}</Pill>}
          {e.is_custom && <Pill tone="accent">Custom</Pill>}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => toggleFavorite.mutate({ id: e.id, isFavorite: e.is_favorite })}
        style={styles.starBtn}
        hitSlop={6}
      >
        <Text style={[styles.star, e.is_favorite && styles.starActive]}>{e.is_favorite ? "★" : "☆"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Exercise Library</Text>
          <Btn label="+ Add Exercise" onPress={openAdd} />
        </View>
        <Input placeholder="Search by name or muscle..." value={search} onChangeText={setSearch} autoCorrect={false} />
        <TouchableOpacity
          style={[styles.favChip, favoritesOnly && styles.favChipActive]}
          onPress={() => setFavoritesOnly((f) => !f)}
        >
          <Text style={[styles.favChipText, favoritesOnly && { color: "#000" }]}>★ Favorites only</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {searchResults ? (
            searchResults.length === 0 ? (
              <EmptyState title="No exercises match" subtitle="Try a different name or muscle group." />
            ) : (
              searchResults.map((e) => <Row key={e.id} e={e} />)
            )
          ) : (
            MUSCLE_GROUPS.map((group) => {
              const groupHasAny = group.muscles.some((m) => (byMuscle.get(m)?.length ?? 0) > 0);
              if (!groupHasAny) return null;
              return (
                <View key={group.title} style={styles.superGroup}>
                  <Text style={styles.superGroupTitle}>{group.title}</Text>
                  {group.muscles.map((muscle) => {
                    const items = byMuscle.get(muscle) ?? [];
                    if (items.length === 0) return null;
                    const isCollapsed = collapsed.has(muscle);
                    return (
                      <View key={muscle} style={styles.section}>
                        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(muscle)}>
                          <Text style={styles.sectionTitle}>
                            {muscle} <Text style={styles.sectionCount}>({items.length})</Text>
                          </Text>
                          <Text style={styles.sectionChevron}>{isCollapsed ? "▸" : "▾"}</Text>
                        </TouchableOpacity>
                        {!isCollapsed && items.map((e) => <Row key={e.id} e={e} />)}
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
          {/* Uncategorized (no muscle group) */}
          {!searchResults && (byMuscle.get("other")?.length ?? 0) > 0 && (
            <View style={styles.superGroup}>
              <Text style={styles.superGroupTitle}>Other</Text>
              {byMuscle.get("other")!.map((e) => (
                <Row key={e.id} e={e} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Detail sheet — anatomy diagram is the anchor */}
      <BottomSheet visible={detail !== null} onClose={() => setDetail(null)}>
        {detail && (
          <ScrollView style={{ maxHeight: 620 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.md }}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailName}>{detail.name}</Text>
                <TouchableOpacity
                  onPress={() => {
                    toggleFavorite.mutate({ id: detail.id, isFavorite: detail.is_favorite });
                    setDetail({ ...detail, is_favorite: !detail.is_favorite });
                  }}
                >
                  <Text style={[styles.star, detail.is_favorite && styles.starActive]}>
                    {detail.is_favorite ? "★" : "☆"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Muscle map — visual anchor */}
              <BodyDiagram
                primary={asRegion(detail.muscle_group)}
                secondary={(detail.secondary_muscles ?? []).map(asRegion).filter(Boolean) as MuscleRegion[]}
              />

              <View style={styles.muscleTags}>
                {detail.muscle_group && <Pill tone="accent">{MUSCLE_LABELS[asRegion(detail.muscle_group)!] ?? detail.muscle_group}</Pill>}
                {(detail.secondary_muscles ?? []).map((m) => (
                  <Pill key={m}>{MUSCLE_LABELS[asRegion(m)!] ?? m}</Pill>
                ))}
              </View>

              <View style={styles.detailRows}>
                <DetailRow label="Equipment" value={detail.equipment ?? "—"} />
                <DetailRow label="Type" value={detail.exercise_type ?? "—"} />
              </View>

              {/* Video / demo */}
              <View style={styles.demoSection}>
                <Text style={styles.sectionHeading}>Demo</Text>
                <View style={styles.demoPlaceholder}>
                  <Text style={styles.demoIcon}>🎬</Text>
                  <Text style={styles.demoPlaceholderText}>No demo video yet</Text>
                  {detail.is_custom && (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() =>
                        Alert.alert("Upload demo", "Video upload is coming in a future release.")
                      }
                    >
                      <Text style={styles.uploadBtnText}>Upload demo video</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* How to perform — numbered steps */}
              {(detail.instructions_steps?.length || detail.notes) && (
                <View style={styles.stepsSection}>
                  <Text style={styles.sectionHeading}>How to perform</Text>
                  {detail.instructions_steps?.length ? (
                    detail.instructions_steps.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.stepText}>{detail.notes}</Text>
                  )}
                </View>
              )}

              {detail.is_custom ? (
                <View style={styles.detailActions}>
                  <Btn label="Edit" variant="secondary" onPress={() => openEdit(detail)} />
                  <Btn
                    label={deleteExercise.isPending ? "Deleting..." : "Delete"}
                    variant="danger"
                    onPress={() => confirmDelete(detail)}
                    loading={deleteExercise.isPending}
                  />
                </View>
              ) : (
                <Text style={styles.builtinHint}>Built-in exercise — part of the default library.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Add / Edit form */}
      <BottomSheet
        visible={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
      >
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sheetTitle}>{editingId != null ? "Edit Exercise" : "Add Exercise"}</Text>
            <Input
              placeholder="Exercise name *"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <Text style={styles.fieldLabel}>Primary muscle *</Text>
            <View style={styles.chipWrap}>
              {ALL_MUSCLES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, form.muscle_group === m && styles.chipActive]}
                  onPress={() => setForm({ ...form, muscle_group: m })}
                >
                  <Text style={[styles.chipText, form.muscle_group === m && { color: "#000" }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Secondary muscles</Text>
            <View style={styles.chipWrap}>
              {ALL_MUSCLES.filter((m) => m !== form.muscle_group).map((m) => {
                const on = form.secondary_muscles.includes(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, on && styles.chipActive]}
                    onPress={() =>
                      setForm({
                        ...form,
                        secondary_muscles: on
                          ? form.secondary_muscles.filter((x) => x !== m)
                          : [...form.secondary_muscles, m],
                      })
                    }
                  >
                    <Text style={[styles.chipText, on && { color: "#000" }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Equipment</Text>
            <View style={styles.chipWrap}>
              {EQUIPMENT.map((eq) => (
                <TouchableOpacity
                  key={eq}
                  style={[styles.chip, form.equipment === eq && styles.chipActive]}
                  onPress={() => setForm({ ...form, equipment: form.equipment === eq ? null : eq })}
                >
                  <Text style={[styles.chipText, form.equipment === eq && { color: "#000" }]}>{eq}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipWrap}>
              {(["compound", "isolation"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, form.exercise_type === t && styles.chipActive]}
                  onPress={() => setForm({ ...form, exercise_type: form.exercise_type === t ? null : t })}
                >
                  <Text style={[styles.chipText, form.exercise_type === t && { color: "#000" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>How to perform (one step per line)</Text>
            <TextInput
              style={[styles.notesInput, { minHeight: 110 }]}
              placeholder={"Set up: ...\nExecution: ...\nCue: ..."}
              placeholderTextColor={colors.muted}
              value={form.steps}
              onChangeText={(v) => setForm({ ...form, steps: v })}
              multiline
            />
            <TextInput
              style={styles.notesInput}
              placeholder="Extra notes (optional)"
              placeholderTextColor={colors.muted}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
            />
            <Btn
              label={saveExercise.isPending ? "Saving..." : editingId != null ? "Save changes" : "Add Exercise"}
              onPress={() => saveExercise.mutate()}
              disabled={!form.name.trim() || !form.muscle_group}
              loading={saveExercise.isPending}
              fullWidth
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    padding: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  favChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  favChipActive: { backgroundColor: colors.accent },
  favChipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  content: { padding: spacing.base, gap: spacing.md, paddingBottom: 48 },
  superGroup: { gap: spacing.sm },
  superGroupTitle: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.white,
    marginTop: spacing.xs,
  },
  section: { gap: spacing.xs },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "capitalize",
  },
  sectionCount: { fontWeight: "400" },
  sectionChevron: { color: colors.muted, fontSize: font.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  rowName: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  rowTags: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  starBtn: { padding: spacing.xs },
  star: { fontSize: 22, color: colors.muted },
  starActive: { color: colors.accent },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.xs },
  fieldLabel: { fontSize: font.xs, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  notesInput: {
    minHeight: 72,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  detailName: { fontSize: font.lg, fontWeight: "700", color: colors.white, flexShrink: 1 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.base },
  detailLabel: { fontSize: font.sm, color: colors.muted },
  detailValue: { fontSize: font.sm, color: colors.white, flex: 1, textAlign: "right", textTransform: "capitalize" },
  detailRows: { gap: spacing.xs },
  muscleTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  sectionHeading: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  demoSection: {},
  demoPlaceholder: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.base,
    alignItems: "center",
    gap: spacing.sm,
  },
  demoIcon: { fontSize: 28 },
  demoPlaceholderText: { fontSize: font.sm, color: colors.muted },
  uploadBtn: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  uploadBtnText: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  stepsSection: { gap: spacing.xs },
  stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginBottom: spacing.sm },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#000", fontSize: font.sm, fontWeight: "800" },
  stepText: { flex: 1, color: colors.white, fontSize: font.sm, lineHeight: 20 },
  detailActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  builtinHint: { fontSize: font.xs, color: colors.muted, fontStyle: "italic" },
});
