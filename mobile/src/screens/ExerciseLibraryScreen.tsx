import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { colors, font, radius, spacing } from "../theme";

const CATEGORIES = [
  "Lower Body",
  "Upper Body — Compound Push",
  "Upper Body — Compound Pull",
];

export default function ExerciseLibraryScreen() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: CATEGORIES[0],
    subcategory: "",
    notes: "",
  });

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises", category, favoritesOnly],
    queryFn: () =>
      api.exercises.list({ category: category || undefined, favorites_only: favoritesOnly }),
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
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const filtered = exercises?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered?.reduce<Record<string, typeof filtered>>((acc, e) => {
    const key = e.subcategory ?? "Other";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Exercise Library</Text>
          <Btn label="+ Add" onPress={() => setAddOpen(true)} />
        </View>

        <Input
          placeholder="Search exercises..."
          value={search}
          onChangeText={setSearch}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: spacing.sm }}>
          {["", ...CATEGORIES].map((c, i) => (
            <TouchableOpacity
              key={c || "all"}
              style={[styles.filterChip, category === c && styles.filterChipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.filterChipText, category === c && styles.filterChipTextActive]}>
                {i === 0 ? "All" : c}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.filterChip, favoritesOnly && styles.filterChipActive]}
            onPress={() => setFavoritesOnly((f) => !f)}
          >
            <Text style={[styles.filterChipText, favoritesOnly && styles.filterChipTextActive]}>
              ★ Favorites
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {isLoading && <Spinner />}

        {!isLoading && grouped && Object.keys(grouped).length === 0 && (
          <EmptyState
            title="No exercises match"
            subtitle={
              favoritesOnly
                ? "Tap ★ on any exercise to favorite it."
                : "Try a different search or category."
            }
          />
        )}

        {grouped &&
          Object.entries(grouped).map(([sub, items]) => (
            <View key={sub} style={styles.group}>
              <Text style={styles.groupLabel}>{sub.toUpperCase()}</Text>
              {items!.map((e) => (
                <View key={e.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{e.name}</Text>
                    {e.notes && <Text style={styles.exerciseNotes}>{e.notes}</Text>}
                  </View>
                  <View style={styles.exerciseActions}>
                    {e.is_custom && <Pill>Custom</Pill>}
                    <TouchableOpacity
                      onPress={() =>
                        toggleFavorite.mutate({ id: e.id, isFavorite: e.is_favorite })
                      }
                      style={styles.starBtn}
                    >
                      <Text style={[styles.star, e.is_favorite && styles.starActive]}>
                        {e.is_favorite ? "★" : "☆"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
      </ScrollView>

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={styles.sheetTitle}>Add Custom Exercise</Text>
        <Input
          placeholder="Exercise name"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
        />
        <View>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryPicker}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryOption, form.category === c && styles.categoryOptionActive]}
                onPress={() => setForm({ ...form, category: c })}
              >
                <Text style={[styles.categoryOptionText, form.category === c && { color: colors.accent }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Input
          placeholder="Subcategory (e.g. Squat pattern)"
          value={form.subcategory}
          onChangeText={(v) => setForm({ ...form, subcategory: v })}
        />
        <Input
          placeholder="Notes / cues (optional)"
          value={form.notes}
          onChangeText={(v) => setForm({ ...form, notes: v })}
          multiline
          style={{ height: 80 }}
        />
        <Btn
          label="Add Exercise"
          onPress={() => createExercise.mutate()}
          disabled={!form.name.trim()}
          loading={createExercise.isPending}
          fullWidth
        />
        <Btn label="Cancel" variant="secondary" onPress={() => setAddOpen(false)} fullWidth />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.base },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  filterRow: { marginVertical: spacing.xs },
  filterChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  filterChipActive: { backgroundColor: colors.accent },
  filterChipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  filterChipTextActive: { color: "#000" },
  group: { gap: spacing.xs },
  groupLabel: { fontSize: font.xs, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  exerciseName: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  exerciseNotes: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  exerciseActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  starBtn: { padding: spacing.sm },
  star: { fontSize: 20, color: colors.muted },
  starActive: { color: colors.accent },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  fieldLabel: { fontSize: font.sm, fontWeight: "500", color: colors.muted, marginBottom: spacing.xs },
  categoryPicker: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  categoryOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryOptionActive: { backgroundColor: colors.accentDim },
  categoryOptionText: { fontSize: font.sm, color: colors.white },
});
