import { useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import MiniBarChart from "../components/MiniBarChart";
import Spinner from "../components/Spinner";
import { usePreviewClientId } from "../contexts/PreviewClient";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";
import { colors, font, radius, spacing } from "../theme";
import type { ProgressRange } from "../types";

const GOLD = "#eab308";
const FLAME = "#f97316";
const BLUE = "#3b82f6";

const RANGES: { key: ProgressRange; label: string }[] = [
  { key: "4w", label: "4 wk" },
  { key: "3m", label: "3 mo" },
  { key: "6m", label: "6 mo" },
  { key: "all", label: "All time" },
];

export default function ClientProgressScreen() {
  const qc = useQueryClient();
  const clientId = usePreviewClientId();
  const route = useRoute();
  const [range, setRange] = useState<ProgressRange>("3m");
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bwSheetOpen, setBwSheetOpen] = useState(false);
  const [bwInput, setBwInput] = useState("");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["client-portal", "progress", range, clientId],
    queryFn: () => api.clientPortal.progress(range, clientId),
  });

  // Arriving from the Dashboard strength card pre-selects that same exercise.
  const paramExerciseId = (route.params as { exerciseId?: number } | undefined)?.exerciseId;
  useEffect(() => {
    if (paramExerciseId != null) setExerciseId(paramExerciseId);
  }, [paramExerciseId]);

  // Default lift: most recently logged (server-decided) — set once data arrives.
  useEffect(() => {
    if (exerciseId == null && data?.default_exercise_id != null) {
      setExerciseId(data.default_exercise_id);
    }
  }, [data, exerciseId]);

  const { data: strength, isLoading: strengthLoading } = useQuery({
    queryKey: ["client-portal", "strength", exerciseId, range, clientId],
    queryFn: () => api.clientPortal.strengthSeries(exerciseId!, range, clientId),
    enabled: exerciseId != null,
  });

  const logBw = useMutation({
    mutationFn: (w: number) => api.clientPortal.logBodyweight(w, clientId),
    onSuccess: () => {
      setBwSheetOpen(false);
      setBwInput("");
      qc.invalidateQueries({ queryKey: ["client-portal", "progress"] });
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>Couldn't load your progress</Text>
        <Text style={styles.errorMsg}>{(error as Error)?.message ?? "Please try again."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { stats } = data;
  const selectedOption = data.exercise_options.find((o) => o.exercise_id === exerciseId);
  const isEmpty = stats.total_workouts === 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.muted} />}
      >
        <Text style={styles.title}>My Progress</Text>

        {/* Global range selector */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.rangeChipText, range === r.key && { color: "#000" }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isEmpty ? (
          <EmptyState
            title="No workouts yet"
            subtitle="Charts light up after your first logged session. 💪"
          />
        ) : (
          <>
            {/* Key stats grid */}
            <View style={styles.grid}>
              <Stat emoji="🔥" value={`${stats.streak_weeks}w`} label="streak" tint={FLAME} />
              <Stat value={String(stats.total_workouts)} label="workouts" />
              <Stat value={String(stats.workouts_this_month)} label="this month" />
              <Stat emoji="🏆" value={String(stats.total_prs)} label="total PRs" tint={GOLD} />
              <Stat
                value={stats.avg_workouts_per_week != null ? String(stats.avg_workouts_per_week) : "—"}
                label="avg / week"
              />
              <Stat
                value={stats.most_improved_lift ? stats.most_improved_lift.split(" +")[1] ?? "—" : "—"}
                label={
                  stats.most_improved_lift
                    ? stats.most_improved_lift.split(" +")[0]
                    : "most improved"
                }
                tint={GOLD}
                small
              />
            </View>

            {/* Strength progression */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Strength progression</Text>
                <TouchableOpacity style={styles.exercisePicker} onPress={() => setPickerOpen(true)}>
                  <Text style={styles.exercisePickerText} numberOfLines={1}>
                    {selectedOption?.exercise_name ?? "Pick a lift"} ▾
                  </Text>
                </TouchableOpacity>
              </View>
              {strengthLoading && <Spinner />}
              {strength && strength.points.length < 2 && (
                <Text style={styles.muted}>
                  Keep logging — your strength trend will show up here after a couple more sessions. 💪
                </Text>
              )}
              {strength && strength.points.length >= 2 && (
                <>
                  <MiniBarChart
                    data={strength.points.map((p) => ({
                      label: formatDate(p.date),
                      value: p.value,
                      marked: p.is_pr,
                    }))}
                    unit={`${strength.unit} e1RM`}
                    height={130}
                  />
                  <Text style={styles.chartCaption}>
                    Estimated 1RM per session · 🏆 = PR day
                  </Text>
                </>
              )}
            </View>

            {/* Consistency */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Consistency</Text>
              <MiniBarChart
                data={data.consistency.map((w) => ({
                  label: `wk of ${formatDate(w.week_start)}`,
                  value: w.workouts,
                }))}
                unit="workouts"
              />
              <Text style={styles.chartCaption}>Workouts per week — showing up is the win.</Text>
            </View>

            {/* Bodyweight — the one thing the client writes */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Bodyweight</Text>
                <TouchableOpacity style={styles.logBwBtn} onPress={() => setBwSheetOpen(true)}>
                  <Text style={styles.logBwBtnText}>+ Log weigh-in</Text>
                </TouchableOpacity>
              </View>
              {data.bodyweight.length === 0 ? (
                <Text style={styles.muted}>
                  Track your bodyweight to see trends here — only you log this, whenever you want.
                </Text>
              ) : (
                <MiniBarChart
                  data={data.bodyweight.map((b) => ({
                    label: formatDate(b.logged_at),
                    value: b.weight,
                  }))}
                  unit={data.bodyweight[0]?.unit ?? "lbs"}
                  height={100}
                />
              )}
            </View>

            {/* PR timeline — trophy case */}
            <View style={[styles.card, styles.trophyCard]}>
              <Text style={[styles.cardTitle, { color: GOLD }]}>🏆 Trophy case</Text>
              {data.pr_timeline.length === 0 && (
                <Text style={styles.muted}>No PRs in this range yet — they're coming.</Text>
              )}
              {data.pr_timeline.map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prExercise}>{pr.exercise_name}</Text>
                    <Text style={styles.prDate}>{formatDate(pr.achieved_at)}</Text>
                  </View>
                  <Text style={styles.prValue}>
                    {pr.pr_type === "estimated_1rm" ? "New e1RM: " : "New best: "}
                    {pr.value} {pr.unit}
                    {pr.pr_type !== "estimated_1rm" && pr.reps ? ` × ${pr.reps}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Exercise picker */}
      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Text style={styles.sheetTitle}>Pick a lift</Text>
        <ScrollView style={{ maxHeight: 380 }}>
          {data.exercise_options.map((o) => (
            <TouchableOpacity
              key={o.exercise_id}
              style={[styles.exOption, exerciseId === o.exercise_id && styles.exOptionActive]}
              onPress={() => {
                setExerciseId(o.exercise_id);
                setPickerOpen(false);
              }}
            >
              <Text style={[styles.exOptionText, exerciseId === o.exercise_id && { color: colors.accent }]}>
                {o.exercise_name}
              </Text>
              {o.pr_count > 0 && <Text style={styles.exOptionPr}>🏆 {o.pr_count}</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Log bodyweight sheet — client-owned write */}
      <BottomSheet visible={bwSheetOpen} onClose={() => setBwSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Log today's weight</Text>
        <Text style={styles.muted}>Visible on your progress chart only.</Text>
        <View style={styles.bwRow}>
          <TextInput
            style={styles.bwInput}
            value={bwInput}
            onChangeText={(v) => setBwInput(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <Text style={styles.bwUnit}>{data.unit}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBwBtn, (!bwInput || logBw.isPending) && { opacity: 0.5 }]}
          disabled={!bwInput || logBw.isPending}
          onPress={() => logBw.mutate(Number(bwInput))}
        >
          <Text style={styles.saveBwText}>{logBw.isPending ? "Saving..." : "Save weigh-in"}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </>
  );
}

function Stat({
  emoji,
  value,
  label,
  tint,
  small,
}: {
  emoji?: string;
  value: string;
  label: string;
  tint?: string;
  small?: boolean;
}) {
  return (
    <View style={[styles.stat, tint ? { borderColor: tint + "50" } : null]}>
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={[styles.statValue, small && styles.statValueSmall, tint ? { color: tint } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
  title: { fontSize: font.xxl, fontWeight: "800", color: colors.white },
  rangeRow: {
    flexDirection: "row",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeChip: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surface },
  rangeChipActive: { backgroundColor: colors.accent },
  rangeChipText: { color: colors.muted, fontSize: font.sm, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: colors.white, fontSize: font.xl, fontWeight: "800" },
  statValueSmall: { fontSize: font.base },
  statLabel: { color: colors.muted, fontSize: font.xs, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  cardTitle: { color: colors.white, fontSize: font.base, fontWeight: "700" },
  exercisePicker: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    maxWidth: 190,
  },
  exercisePickerText: { color: colors.accent, fontSize: font.xs, fontWeight: "600" },
  chartCaption: { color: colors.muted, fontSize: font.xs },
  muted: { color: colors.muted, fontSize: font.sm },
  logBwBtn: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  logBwBtnText: { color: colors.accent, fontSize: font.xs, fontWeight: "700" },
  trophyCard: { borderColor: GOLD + "50", backgroundColor: GOLD + "10" },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GOLD + "22",
  },
  prExercise: { color: colors.white, fontSize: font.sm, fontWeight: "600" },
  prDate: { color: colors.muted, fontSize: font.xs, marginTop: 1 },
  prValue: { color: GOLD, fontSize: font.sm, fontWeight: "700" },
  sheetTitle: { color: colors.white, fontSize: font.lg, fontWeight: "700", marginBottom: spacing.xs },
  exOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exOptionActive: { backgroundColor: colors.accentDim },
  exOptionText: { color: colors.white, fontSize: font.sm, flex: 1 },
  exOptionPr: { color: GOLD, fontSize: font.xs },
  bwRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  bwInput: {
    flex: 1,
    height: 56,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    color: colors.white,
    fontSize: font.xxl,
    fontWeight: "700",
    textAlign: "center",
  },
  bwUnit: { color: colors.muted, fontSize: font.lg, fontWeight: "600" },
  saveBwBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBwText: { color: "#000", fontWeight: "700", fontSize: font.base },
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
