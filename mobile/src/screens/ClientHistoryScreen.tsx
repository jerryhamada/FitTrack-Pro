import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { usePreviewClientId } from "../contexts/PreviewClient";
import { api } from "../lib/api";
import { formatDuration } from "../lib/utils";
import { colors, font, radius, spacing } from "../theme";
import type {
  DistanceUnit,
  PortalHistoryItem,
  PortalHistorySet,
  PortalWorkoutExercise,
  Unit,
} from "../types";

const GOLD = "#eab308";
const FLAME = "#f97316";
const META = "#c7cbc7";

type RangeKey = "all" | "30" | "90";
type SortKey = "newest" | "oldest";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

// ---------- formatting helpers ----------

function historyDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const full = d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
  if (d.toDateString() === today.toDateString()) return `TODAY · ${full}`;
  if (d.toDateString() === yesterday.toDateString()) return `YESTERDAY · ${full}`;
  return full;
}

function volumeLabel(v: number, unit: string): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k ${unit}` : `${Math.round(v)} ${unit}`;
}

function setValueLabel(st: PortalHistorySet): string {
  if (st.height != null) {
    const h = st.height % 1 === 0 ? st.height : st.height.toFixed(1);
    return `${h} ${(st.height_unit as DistanceUnit) ?? "in"}`;
  }
  if (st.weight != null) {
    const w = st.weight % 1 === 0 ? st.weight : st.weight.toFixed(1);
    return `${w} ${(st.weight_unit as Unit) ?? "lbs"}`;
  }
  return "BW";
}

function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------- superset-aware detail grouping ----------

type DetailBlock =
  | { type: "standalone"; ex: PortalWorkoutExercise }
  | { type: "superset"; groupId: string; members: PortalWorkoutExercise[]; rounds: number };

function buildDetailBlocks(exercises: PortalWorkoutExercise[]): DetailBlock[] {
  const blocks: DetailBlock[] = [];
  const emitted = new Set<string>();
  for (const ex of exercises) {
    if (ex.superset_group_id) {
      if (emitted.has(ex.superset_group_id)) continue;
      emitted.add(ex.superset_group_id);
      const members = exercises
        .filter((e) => e.superset_group_id === ex.superset_group_id)
        .sort((a, b) => (a.superset_order ?? 0) - (b.superset_order ?? 0));
      const rounds = Math.max(...members.map((m) => m.sets.length));
      blocks.push({ type: "superset", groupId: ex.superset_group_id, members, rounds });
    } else {
      blocks.push({ type: "standalone", ex });
    }
  }
  return blocks;
}

// ---------- screen ----------

export default function ClientHistoryScreen() {
  const clientId = usePreviewClientId();
  const [filterOpen, setFilterOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["client-portal", "history", clientId],
    queryFn: () => api.clientPortal.history(clientId),
  });

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
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Tap a workout to see the full log</Text>
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={colors.muted} />
            {filtersActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {isEmpty ? (
          <EmptyState title="No workouts logged yet" subtitle="Your first session is coming up! 💪" />
        ) : (
          <>
            {/* Summary strip */}
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
                        <View style={{ flex: 1 }}>
                          <Text style={styles.workoutDate}>{historyDateLabel(w.started_at)}</Text>
                          <Text style={styles.workoutTitle}>{w.title}</Text>
                        </View>
                        {w.pr_count > 0 && (
                          <View style={styles.prPill}>
                            <Text style={styles.prPillText}>
                              🏆 {w.pr_count} PR{w.pr_count === 1 ? "" : "s"}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <MetaChip icon="clock-outline" label={formatDuration(w.duration_seconds)} />
                        <MetaChip icon="dumbbell" label={volumeLabel(w.total_volume, w.total_volume_unit)} />
                        <MetaChip
                          icon="format-list-bulleted"
                          label={`${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}`}
                        />
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

      {/* Full-screen read-only workout detail */}
      <WorkoutDetailModal workoutId={detailId} clientId={clientId} onClose={() => setDetailId(null)} />
    </>
  );
}

function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metaChip}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.muted} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function SetRow({ st, isPR }: { st: PortalHistorySet; isPR: boolean }) {
  return (
    <View style={[styles.setRow, isPR && styles.setRowPR]}>
      <Text style={styles.setNum}>Set {st.set_number}</Text>
      <Text style={[styles.setValue, isPR && { color: GOLD }]}>
        {setValueLabel(st)}
        {st.reps != null ? ` × ${st.reps}` : ""}
        {st.effort_value != null ? `  ${st.effort_type?.toUpperCase()} ${st.effort_value}` : ""}
      </Text>
      {isPR && <Text style={styles.setPrTag}>🏆 PR</Text>}
      {st.status !== "completed" && <Text style={styles.setStatus}>{st.status}</Text>}
    </View>
  );
}

function WorkoutDetailModal({
  workoutId,
  clientId,
  onClose,
}: {
  workoutId: number | null;
  clientId: number | undefined;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useQuery({
    queryKey: ["client-portal", "workout", workoutId, clientId],
    queryFn: () => api.clientPortal.workoutDetail(workoutId!, clientId),
    enabled: workoutId != null,
  });

  return (
    <Modal visible={workoutId != null} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.modal, { paddingTop: insets.top }]}>
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            <TouchableOpacity style={styles.backRow} onPress={onClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.accent} />
              <Text style={styles.backText}>History</Text>
            </TouchableOpacity>

            <Text style={styles.detailDate}>{historyDateLabel(data.started_at)}</Text>
            <Text style={styles.detailTitle}>{data.title}</Text>

            <View style={styles.detailStatsRow}>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatValue}>{formatDuration(data.duration_seconds)}</Text>
                <Text style={styles.detailStatLabel}>duration</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatValue}>
                  {volumeLabel(data.total_volume, data.total_volume_unit)}
                </Text>
                <Text style={styles.detailStatLabel}>total volume</Text>
              </View>
              <View style={[styles.detailStat, styles.detailStatPr]}>
                <Text style={[styles.detailStatValue, { color: GOLD }]}>{data.pr_count}</Text>
                <Text style={[styles.detailStatLabel, { color: "#c9b25a" }]}>PRs</Text>
              </View>
            </View>

            {data.notes ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>“{data.notes}”</Text>
              </View>
            ) : null}

            <Text style={styles.exercisesLabel}>EXERCISES</Text>

            {buildDetailBlocks(data.exercises).map((block) =>
              block.type === "standalone" ? (
                <View key={`ex-${block.ex.exercise_id}`} style={styles.exerciseCard}>
                  <Text style={styles.exerciseName}>{block.ex.exercise_name}</Text>
                  {block.ex.sets.map((st) => (
                    <SetRow key={st.set_number} st={st} isPR={st.is_pr} />
                  ))}
                </View>
              ) : (
                <View key={`ss-${block.groupId}`} style={[styles.exerciseCard, styles.supersetCard]}>
                  <Text style={styles.supersetLabel}>
                    Superset {block.groupId} ·{" "}
                    {block.members.map((m) => m.exercise_name.split(" (")[0]).join(" + ")}
                  </Text>
                  {Array.from({ length: block.rounds }, (_, r) => (
                    <View key={r} style={styles.roundBlock}>
                      <Text style={styles.roundLabel}>Round {r + 1}</Text>
                      {block.members.map((m) => {
                        const st = m.sets[r];
                        if (!st) return null;
                        return (
                          <View key={m.exercise_id} style={[styles.roundSetRow, st.is_pr && styles.setRowPR]}>
                            <Text style={styles.roundMember} numberOfLines={1}>
                              {m.exercise_name.split(" (")[0]}
                            </Text>
                            <Text style={[styles.setValue, st.is_pr && { color: GOLD }]}>
                              {setValueLabel(st)}
                              {st.reps != null ? ` × ${st.reps}` : ""}
                            </Text>
                            {st.is_pr && <Text style={styles.setPrTag}>🏆</Text>}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )
            )}
            <View style={{ height: insets.bottom + spacing.xl }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: font.xxl, fontWeight: "800", color: colors.white },
  subtitle: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
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
    borderRadius: radius.lg + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  workoutTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  workoutDate: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  workoutTitle: { color: colors.white, fontSize: font.lg, fontWeight: "800" },
  prPill: {
    backgroundColor: GOLD + "1a",
    borderWidth: 1,
    borderColor: GOLD + "59",
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  prPillText: { color: GOLD, fontSize: font.xs, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.base },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: META, fontSize: font.sm },
  link: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },

  // filter sheet
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

  // detail modal
  modal: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: spacing.base, paddingTop: spacing.xs },
  backRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, alignSelf: "flex-start" },
  backText: { color: colors.accent, fontSize: font.base, fontWeight: "700" },
  detailDate: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  detailTitle: { color: colors.white, fontSize: font.xxl, fontWeight: "800", marginTop: 3, marginBottom: spacing.base },
  detailStatsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.base },
  detailStat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md + 2,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  detailStatPr: { backgroundColor: GOLD + "14", borderWidth: 1, borderColor: GOLD + "4d" },
  detailStatValue: { color: colors.white, fontSize: font.lg, fontWeight: "800" },
  detailStatLabel: { color: colors.muted, fontSize: font.xs },
  notesCard: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.md + 2,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  notesText: { color: "#d6ead9", fontSize: font.sm, fontStyle: "italic" },
  exercisesLabel: {
    color: colors.muted,
    fontSize: font.xs,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  exerciseName: { color: colors.white, fontSize: font.base, fontWeight: "800", marginBottom: 4 },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  setRowPR: {
    backgroundColor: GOLD + "10",
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    marginLeft: -spacing.sm,
  },
  setNum: { color: colors.muted, fontSize: font.sm, width: 52 },
  setValue: { flex: 1, color: colors.white, fontSize: font.base, fontWeight: "600" },
  setPrTag: { color: GOLD, fontSize: font.xs, fontWeight: "700" },
  setStatus: { color: colors.muted, fontSize: font.xs, textTransform: "capitalize" },
  supersetCard: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  supersetLabel: { color: colors.accent, fontSize: font.sm, fontWeight: "700", marginBottom: 4 },
  roundBlock: { gap: 2, marginTop: spacing.xs },
  roundLabel: { color: colors.muted, fontSize: font.xs, fontWeight: "600", textTransform: "uppercase" },
  roundSetRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm, paddingVertical: 3 },
  roundMember: { color: colors.muted, fontSize: font.xs, width: 96 },

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
