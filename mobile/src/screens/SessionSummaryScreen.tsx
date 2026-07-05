import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import { api } from "../lib/api";
import { formatDuration, formatWeight } from "../lib/utils";
import type { SessionSummary, WorkoutSession } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SessionSummary">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function exerciseBreakdown(session: WorkoutSession) {
  return [...session.session_exercises]
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => {
      const sets = session.sets.filter((s) => s.exercise_id === m.exercise_id);
      const working = sets.filter((s) => s.status !== "skipped");
      const best = working.reduce<(typeof working)[number] | null>((top, s) => {
        if (s.weight == null || s.reps == null) return top;
        if (!top || s.weight * s.reps > (top.weight ?? 0) * (top.reps ?? 0)) return s;
        return top;
      }, null);
      return {
        exerciseId: m.exercise_id,
        name: m.exercise_name,
        workingSets: working.length,
        best,
      };
    });
}

export default function SessionSummaryScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { sessionId, summary: passedSummary } = route.params;
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");

  function confirm() {
    if (status !== "idle") return;
    setStatus("saving");
    setTimeout(() => {
      setStatus("done");
      setTimeout(() => navigation.replace("MainTabs"), 900);
    }, 600);
  }

  // Always fetch the full session — the aggregate summary doesn't carry the
  // per-exercise breakdown this screen needs, but this query is almost always
  // a cache hit since SessionLogScreen just fetched the same key.
  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.sessions.get(sessionId),
  });

  const exercises = useMemo(() => (session ? exerciseBreakdown(session) : []), [session]);

  if (isLoading || !session) return <Spinner />;

  const summary: SessionSummary = passedSummary ?? deriveSummary(session);

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Nice work — here's how it went.</Text>

      <View style={styles.statsGrid}>
        <StatCard
          label="Total Volume"
          value={`${Math.round(summary.total_volume).toLocaleString()} ${summary.total_volume_unit}`}
          accent
        />
        <StatCard label="Sets Completed" value={String(summary.total_sets)} />
        <StatCard label="Duration" value={formatDuration(summary.duration_seconds)} />
        <StatCard
          label="PRs Hit"
          value={String(summary.prs_hit.length)}
          accent={summary.prs_hit.length > 0}
        />
      </View>

      {summary.prs_hit.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PRs hit this session</Text>
          {summary.prs_hit.map((s) => (
            <View key={s.id} style={styles.prRow}>
              <Text style={styles.prName}>{s.exercise_name}</Text>
              <View style={styles.prRight}>
                <Pill tone="accent">
                  {s.pr_type === "estimated_1rm" ? "Est. 1RM" : "Weight PR"}
                </Pill>
                <Text style={styles.prValue}>
                  {formatWeight(s.weight, s.weight_unit)} × {s.reps}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exercises</Text>
        {exercises.map((ex) => (
          <View key={ex.exerciseId} style={styles.exerciseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.best && (
                <Text style={styles.exerciseBest}>
                  Best: {formatWeight(ex.best.weight, ex.best.weight_unit)} × {ex.best.reps}
                </Text>
              )}
            </View>
            <Text style={styles.exerciseSets}>
              {ex.workingSets} {ex.workingSets === 1 ? "set" : "sets"}
            </Text>
          </View>
        ))}
      </View>
      </ScrollView>
      {status === "done" && (
        <View style={styles.toast}>
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />
          <Text style={styles.toastText}>Workout logged</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={confirm}
        activeOpacity={0.85}
        disabled={status !== "idle"}
      >
        {status === "saving" ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <MaterialCommunityIcons name="check" size={28} color={colors.bg} />
        )}
      </TouchableOpacity>
    </View>
  );
}

function deriveSummary(session: WorkoutSession): SessionSummary {
  const sets = session.sets;
  const prs = sets.filter((s) => s.is_pr);
  const unit = sets.find((s) => s.weight_unit)?.weight_unit ?? "lbs";
  const completedSets = sets.filter((s) => s.status !== "skipped");
  const totalVolume = sets.reduce((sum, s) => {
    if (s.status === "skipped" || s.weight == null || !s.reps) return sum;
    const load = s.is_per_side ? s.weight * 2 : s.weight;
    return sum + load * s.reps;
  }, 0);
  return {
    session_id: session.id,
    total_volume: totalVolume,
    total_volume_unit: unit,
    total_sets: completedSets.length,
    duration_seconds: session.duration_seconds,
    prs_hit: prs,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: "absolute",
    right: spacing.base,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  toast: {
    position: "absolute",
    right: spacing.base,
    bottom: spacing.xl + 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toastText: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  content: { padding: spacing.base, gap: spacing.base },
  subtitle: { fontSize: font.sm, color: colors.muted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  prName: { fontSize: font.sm, fontWeight: "500", color: colors.white, flex: 1 },
  prRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prValue: { fontSize: font.sm, color: colors.muted },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  exerciseName: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  exerciseBest: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  exerciseSets: { fontSize: font.sm, color: colors.accent, fontWeight: "600" },
});
