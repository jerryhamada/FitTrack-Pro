import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatDate, formatDuration, formatWeight } from "../lib/utils";
import { colors, font, radius, spacing } from "../theme";
import type { PortalHistoryItem } from "../types";

const GOLD = "#eab308";
const FLAME = "#f97316";

type RangeKey = "all" | "30" | "90";
type SortKey = "newest" | "oldest";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function condensedExercises(w: PortalHistoryItem): string {
  const names = w.exercises.slice(0, 3).map((e) => e.name.split(" (")[0]);
  const more = w.exercises.length > 3 ? ` +${w.exercises.length - 3}` : "";
  return names.join(" · ") + more;
}

export default function ClientHistoryScreen() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["client-portal", "history"],
    queryFn: () => api.clientPortal.history(),
  });

  // Distinct exercises across all workouts, for the filter picker.
  const exerciseOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const w of data?.workouts ?? []) for (const e of w.exercises) map.set(e.id, e.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    let list = data?.workouts ?? [];
    if (range !== "all") {
      const cutoff = Date.now() - Number(range) * 86_400_000;
      list = list.filter((w) => new Date(w.started_at).getTime() >= cutoff);
    }
    if (exerciseId != null) list = list.filter((w) => w.exercises.some((e) => e.id === exerciseId));
    list = [...list].sort((a, b) => {
      const d = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      return sort === "newest" ? -d : d;
    });
    return list;
  }, [data, range, exerciseId, sort]);

  // Group filtered list by month (order preserved from the sort above).
  const groups = useMemo(() => {
    const out: { month: string; items: PortalHistoryItem[] }[] = [];
    for (const w of filtered) {
      const m = monthKey(w.started_at);
      const last = out[out.length - 1];
      if (last && last.month === m) last.items.push(w);
      else out.push({ month: m, items: [w] });
    }
    return out;
  }, [filtered]);

  const filtersActive = range !== "all" || exerciseId != null || sort !== "newest";
  const clearFilters = () => {
    setRange("all");
    setExerciseId(null);
    setSort("newest");
  };

  if (isLoading) return <Spinner />;
  if (isError || !data) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>Couldn't load your history</Text>
        <Text style={styles.errorMsg}>{(error as Error)?.message ?? "Please try again."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary } = data;
  const isEmpty = summary.total_workouts === 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.muted} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
            <Text style={{ fontSize: 16 }}>⚙</Text>
            {filtersActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {isEmpty ? (
          <EmptyState
            title="No workouts logged yet"
            subtitle="Your first session is coming up! 💪"
          />
        ) : (
          <>
            {/* Summary strip — streak/consistency first, volume stays off the headline */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: FLAME + "50" }]}>
                <Text style={styles.summaryEmoji}>🔥</Text>
                <Text style={[styles.summaryValue, { color: FLAME }]}>{summary.streak_weeks}</Text>
                <Text style={styles.summaryLabel}>week streak</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.workouts_this_month}</Text>
                <Text style={styles.summaryLabel}>this month</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.total_workouts}</Text>
                <Text style={styles.summaryLabel}>total</Text>
              </View>
            </View>

            {/* Grouped list */}
            {groups.length === 0 ? (
              <EmptyState
                title="No workouts match your filters"
                subtitle="Try widening the date range or clearing the exercise filter."
                action={
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={styles.link}>Clear filters</Text>
                  </TouchableOpacity>
                }
              />
            ) : (
              groups.map((g) => (
                <View key={g.month} style={styles.group}>
                  <Text style={styles.monthLabel}>{g.month}</Text>
                  {g.items.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.workoutCard}
                      onPress={() => setDetailId(w.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.workoutTop}>
                        <Text style={styles.workoutDate}>{formatDate(w.started_at)}</Text>
                        <Text style={styles.workoutDuration}>{formatDuration(w.duration_seconds)}</Text>
                      </View>
                      <Text style={styles.workoutExercises} numberOfLines={1}>
                        {condensedExercises(w)}
                      </Text>
                      <View style={styles.workoutBottom}>
                        {w.pr_count > 0 && (
                          <Text style={styles.prBadge}>
                            🏆 {w.pr_count} PR{w.pr_count === 1 ? "" : "s"}
                          </Text>
                        )}
                        <Text style={styles.volume}>
                          {Math.round(w.total_volume).toLocaleString()} {w.total_volume_unit} volume
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Filter / sort sheet */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <Text style={styles.sheetTitle}>Filter & sort</Text>

        <Text style={styles.sheetLabel}>Date range</Text>
        <View style={styles.chipRow}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.chip, range === r.key && styles.chipActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.chipText, range === r.key && { color: "#000" }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sheetLabel}>Sort</Text>
        <View style={styles.chipRow}>
          {(["newest", "oldest"] as SortKey[]).map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.chip, sort === k && styles.chipActive]}
              onPress={() => setSort(k)}
            >
              <Text style={[styles.chipText, sort === k && { color: "#000" }]}>
                {k === "newest" ? "Newest first" : "Oldest first"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sheetLabel}>Exercise</Text>
        <ScrollView style={{ maxHeight: 200 }}>
          <TouchableOpacity
            style={[styles.exOption, exerciseId == null && styles.exOptionActive]}
            onPress={() => setExerciseId(null)}
          >
            <Text style={[styles.exOptionText, exerciseId == null && { color: colors.accent }]}>
              All exercises
            </Text>
          </TouchableOpacity>
          {exerciseOptions.map(([id, name]) => (
            <TouchableOpacity
              key={id}
              style={[styles.exOption, exerciseId === id && styles.exOptionActive]}
              onPress={() => setExerciseId(id)}
            >
              <Text style={[styles.exOptionText, exerciseId === id && { color: colors.accent }]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.doneBtn} onPress={() => setFilterOpen(false)}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Read-only workout detail */}
      <WorkoutDetailSheet workoutId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

function WorkoutDetailSheet({ workoutId, onClose }: { workoutId: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-portal", "workout", workoutId],
    queryFn: () => api.clientPortal.workoutDetail(workoutId!),
    enabled: workoutId != null,
  });

  return (
    <BottomSheet visible={workoutId != null} onClose={onClose}>
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sheetTitle}>{formatDate(data.started_at)}</Text>
          <View style={styles.detailMeta}>
            <Text style={styles.detailMetaText}>{formatDuration(data.duration_seconds)}</Text>
            {data.pr_count > 0 && <Text style={styles.detailPr}>🏆 {data.pr_count} PR{data.pr_count === 1 ? "" : "s"}</Text>}
            <Text style={styles.detailMetaText}>
              {Math.round(data.total_volume).toLocaleString()} {data.total_volume_unit}
            </Text>
          </View>
          {data.notes && <Text style={styles.detailNotes}>“{data.notes}”</Text>}
          <ScrollView style={{ maxHeight: 440 }}>
            {data.exercises.map((ex) => (
              <View key={ex.exercise_id} style={styles.detailExercise}>
                <Text style={styles.detailExName}>{ex.exercise_name}</Text>
                {ex.sets.map((st) => (
                  <View key={st.set_number} style={styles.detailSetRow}>
                    <Text style={styles.detailSetNum}>#{st.set_number}</Text>
                    <Text style={styles.detailSetValue}>
                      {st.weight != null ? formatWeight(st.weight, (st.weight_unit as "lbs" | "kg" | null) ?? null) : "BW"}
                      {st.reps != null ? ` × ${st.reps}` : ""}
                      {st.effort_value != null ? `  ${st.effort_type?.toUpperCase()} ${st.effort_value}` : ""}
                    </Text>
                    {st.is_pr && <Text style={styles.detailSetPr}>🏆</Text>}
                    {st.status !== "completed" && <Text style={styles.detailSetStatus}>{st.status}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: font.xxl, fontWeight: "800", color: colors.white },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.base,
    alignItems: "center",
    gap: 2,
  },
  summaryEmoji: { fontSize: 18 },
  summaryValue: { color: colors.white, fontSize: font.xl, fontWeight: "800" },
  summaryLabel: { color: colors.muted, fontSize: font.xs },
  group: { gap: spacing.sm },
  monthLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workoutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
  },
  workoutTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workoutDate: { color: colors.white, fontSize: font.base, fontWeight: "700" },
  workoutDuration: { color: colors.muted, fontSize: font.sm },
  workoutExercises: { color: colors.muted, fontSize: font.sm },
  workoutBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prBadge: { color: GOLD, fontSize: font.sm, fontWeight: "700" },
  volume: { color: colors.muted, fontSize: font.xs, marginLeft: "auto" },
  link: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  sheetTitle: { color: colors.white, fontSize: font.lg, fontWeight: "700", marginBottom: spacing.xs },
  sheetLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: font.xs, fontWeight: "600" },
  exOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  exOptionActive: { backgroundColor: colors.accentDim },
  exOptionText: { color: colors.white, fontSize: font.sm },
  doneBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  doneBtnText: { color: "#000", fontWeight: "700", fontSize: font.base },
  detailMeta: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  detailMetaText: { color: colors.muted, fontSize: font.sm },
  detailPr: { color: GOLD, fontSize: font.sm, fontWeight: "700" },
  detailNotes: { color: colors.muted, fontSize: font.sm, fontStyle: "italic" },
  detailExercise: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.xs },
  detailExName: { color: colors.white, fontSize: font.base, fontWeight: "600" },
  detailSetRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailSetNum: { color: colors.muted, fontSize: font.xs, width: 26 },
  detailSetValue: { color: colors.white, fontSize: font.sm, flex: 1 },
  detailSetPr: { fontSize: font.sm },
  detailSetStatus: { color: colors.muted, fontSize: font.xs, textTransform: "capitalize" },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  errorEmoji: { fontSize: 40 },
  errorTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, textAlign: "center" },
  errorMsg: { fontSize: font.sm, color: colors.muted, textAlign: "center" },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryText: { color: "#000", fontWeight: "700", fontSize: font.base },
});
