import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Btn from "../components/Btn";
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

export default function SessionSummaryScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { sessionId, summary: passedSummary, clientId: passedClientId } = route.params;

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.sessions.get(sessionId),
    enabled: !passedSummary,
  });

  if (!passedSummary && (isLoading || !session)) return <Spinner />;

  const summary: SessionSummary = passedSummary ?? deriveSummary(session!);
  const clientId = passedClientId ?? session?.client_id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Session Complete</Text>
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

      <Btn
        label="Back to Client"
        onPress={() => {
          if (clientId) {
            navigation.navigate("ClientProfile", { clientId });
          } else {
            navigation.navigate("MainTabs");
          }
        }}
        fullWidth
      />
      <Btn
        label="Dashboard"
        variant="secondary"
        onPress={() => navigation.navigate("MainTabs")}
        fullWidth
      />
    </ScrollView>
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
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
});
