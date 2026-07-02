import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet from "../../components/BottomSheet";
import EmptyState from "../../components/EmptyState";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDate, formatDuration, formatWeight } from "../../lib/utils";
import type { RootStackParamList } from "../../navigation/types";
import { colors, font, radius, spacing } from "../../theme";
import type { Client, SessionListItem } from "../../types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RangeKey = "all" | "30" | "90";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

export default function HistoryTab({ client }: { client: Client }) {
  const navigation = useNavigation<Nav>();
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["client-sessions", client.id, exerciseId],
    queryFn: () => api.clients.sessions(client.id, exerciseId ?? undefined),
  });
  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });
  const { data: expanded, isLoading: expandedLoading } = useQuery({
    queryKey: ["session", expandedId],
    queryFn: () => api.sessions.get(expandedId!),
    enabled: expandedId !== null,
  });

  const filtered = useMemo(() => {
    let list = sessions ?? [];
    if (range !== "all") {
      const cutoff = Date.now() - Number(range) * 86_400_000;
      list = list.filter((s) => new Date(s.started_at).getTime() >= cutoff);
    }
    return list;
  }, [sessions, range]);

  const selectedExercise = exercises?.find((e) => e.id === exerciseId);

  const renderRow = ({ item }: { item: SessionListItem }) => {
    const inProgress = item.ended_at === null;
    const isOpen = expandedId === item.id;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => {
          if (inProgress) {
            navigation.navigate("SessionLog", { sessionId: item.id });
          } else {
            setExpandedId(isOpen ? null : item.id);
          }
        }}
      >
        <View style={styles.rowTop}>
          <Text style={styles.rowDate}>{formatDate(item.started_at)}</Text>
          {inProgress ? (
            <Text style={styles.inProgress}>In progress — tap to resume</Text>
          ) : (
            <Text style={styles.rowDuration}>{formatDuration(item.duration_seconds)}</Text>
          )}
        </View>
        {item.label && <Text style={styles.rowLabel}>{item.label}</Text>}
        <View style={styles.rowStats}>
          <Text style={styles.rowStat}>{item.exercise_count} exercises</Text>
          <Text style={styles.rowStat}>
            {Math.round(item.total_volume).toLocaleString()} {item.total_volume_unit}
          </Text>
          {item.pr_count > 0 && <Text style={styles.prBadge}>🏆 {item.pr_count}</Text>}
        </View>
        {item.notes_preview && (
          <Text style={styles.notesPreview} numberOfLines={1}>
            {item.notes_preview}
          </Text>
        )}

        {isOpen && (
          <View style={styles.detail}>
            {expandedLoading && <Spinner />}
            {expanded?.sets.map((s) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setName} numberOfLines={1}>
                  {s.exercise_name}
                </Text>
                <Text style={styles.setValue}>
                  {formatWeight(s.weight, s.weight_unit)}
                  {s.reps != null ? ` × ${s.reps}` : ""}
                  {s.is_pr ? " 🏆" : ""}
                  {s.status !== "completed" ? ` (${s.status})` : ""}
                </Text>
              </View>
            ))}
            {expanded && expanded.sets.length === 0 && (
              <Text style={styles.muted}>No sets logged in this session.</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filters}>
        <View style={styles.rangeChips}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.chip, range === r.key && styles.chipActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.exerciseFilter} onPress={() => setPickerOpen(true)}>
          <Text style={styles.exerciseFilterText} numberOfLines={1}>
            {selectedExercise ? `Exercise: ${selectedExercise.name}` : "Filter by exercise..."}
          </Text>
          {exerciseId !== null && (
            <TouchableOpacity onPress={() => setExerciseId(null)} hitSlop={8}>
              <Text style={styles.clearX}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderRow}
          ListEmptyComponent={
            <EmptyState
              title={exerciseId || range !== "all" ? "No workouts match" : "No workouts yet"}
              subtitle={
                exerciseId || range !== "all"
                  ? "Loosen the filters to see more history."
                  : "Completed sessions will appear here."
              }
            />
          }
        />
      )}

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Text style={styles.sheetTitle}>Show sessions containing…</Text>
        <FlatList
          data={exercises ?? []}
          keyExtractor={(e) => String(e.id)}
          style={{ maxHeight: 380 }}
          renderItem={({ item: e }) => (
            <TouchableOpacity
              style={[styles.sheetOption, exerciseId === e.id && styles.sheetOptionActive]}
              onPress={() => {
                setExerciseId(e.id);
                setPickerOpen(false);
              }}
            >
              <Text style={[styles.sheetOptionText, exerciseId === e.id && { color: colors.accent }]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { padding: spacing.base, paddingBottom: spacing.sm, gap: spacing.sm },
  rangeChips: { flexDirection: "row", gap: spacing.sm },
  chip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#000" },
  exerciseFilter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  exerciseFilterText: { fontSize: font.sm, color: colors.muted, flex: 1 },
  clearX: { color: colors.muted, fontSize: font.sm, paddingLeft: spacing.sm },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowDate: { fontSize: font.base, fontWeight: "600", color: colors.white },
  rowDuration: { fontSize: font.sm, color: colors.muted },
  inProgress: { fontSize: font.xs, color: colors.accent, fontWeight: "600" },
  rowLabel: { fontSize: font.sm, color: colors.accent },
  rowStats: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  rowStat: { fontSize: font.sm, color: colors.muted },
  prBadge: { fontSize: font.sm, color: colors.white },
  notesPreview: { fontSize: font.xs, color: colors.muted, fontStyle: "italic" },
  detail: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  setRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  setName: { fontSize: font.sm, color: colors.white, flex: 1 },
  setValue: { fontSize: font.sm, color: colors.muted },
  muted: { fontSize: font.sm, color: colors.muted },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  sheetOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetOptionActive: { backgroundColor: colors.accentDim },
  sheetOptionText: { fontSize: font.sm, color: colors.white },
});
