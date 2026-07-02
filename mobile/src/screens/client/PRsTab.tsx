import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import EmptyState from "../../components/EmptyState";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import { colors, font, radius, spacing } from "../../theme";

type SortKey = "recent" | "count" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent PR" },
  { key: "count", label: "Most PRs" },
  { key: "name", label: "Name" },
];

export default function PRsTab({ clientId }: { clientId: number }) {
  const [sort, setSort] = useState<SortKey>("recent");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["pr-summary", clientId],
    queryFn: () => api.clients.prSummary(clientId),
  });
  const { data: badges } = useQuery({
    queryKey: ["badges", clientId],
    queryFn: () => api.clients.badges(clientId),
  });

  const sorted = useMemo(() => {
    const list = [...(summary?.exercises ?? [])];
    if (sort === "recent") {
      list.sort((a, b) => {
        const ta = a.last_pr_at ? new Date(a.last_pr_at).getTime() : 0;
        const tb = b.last_pr_at ? new Date(b.last_pr_at).getTime() : 0;
        return tb - ta;
      });
    } else if (sort === "count") {
      list.sort((a, b) => b.pr_count - a.pr_count);
    } else {
      list.sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
    }
    return list;
  }, [summary, sort]);

  if (isLoading) return <Spinner />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Summary strip */}
      <View style={styles.strip}>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{summary?.lifetime_pr_count ?? 0}</Text>
          <Text style={styles.stripLabel}>Lifetime PRs</Text>
        </View>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{summary?.prs_this_month ?? 0}</Text>
          <Text style={styles.stripLabel}>This month</Text>
        </View>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>
            {summary?.last_pr_at ? formatDate(summary.last_pr_at) : "—"}
          </Text>
          <Text style={styles.stripLabel}>Last PR</Text>
        </View>
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.chip, sort === s.key && styles.chipActive]}
            onPress={() => setSort(s.key)}
          >
            <Text style={[styles.chipText, sort === s.key && { color: "#000" }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Per-exercise breakdown */}
      {sorted.length === 0 && (
        <EmptyState
          title="No lifts logged yet"
          subtitle="Best lifts and PRs show up automatically as sets are logged."
        />
      )}
      {sorted.map((e) => (
        <View key={e.exercise_id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {e.exercise_name}
            </Text>
            {e.pr_count > 0 && <Text style={styles.prCount}>🏆 {e.pr_count}</Text>}
          </View>
          <View style={styles.statRow}>
            <MiniStat
              label="Best weight"
              value={
                e.best_weight != null
                  ? `${e.best_weight} ${summary?.unit}${e.best_weight_reps ? ` × ${e.best_weight_reps}` : ""}`
                  : "—"
              }
            />
            <MiniStat label="Est. 1RM" value={e.best_e1rm != null ? `${e.best_e1rm} ${summary?.unit}` : "—"} />
            <MiniStat
              label="Best set vol."
              value={e.best_set_volume != null ? `${Math.round(e.best_set_volume)} ${summary?.unit}` : "—"}
            />
          </View>
          <Text style={styles.lastPr}>
            {e.last_pr_at ? `Last PR ${formatDate(e.last_pr_at)}` : "No PRs yet"}
          </Text>
        </View>
      ))}

      {/* Badges */}
      {(badges?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>Badges earned</Text>
          <View style={styles.badgesWrap}>
            {badges?.map((b) => (
              <View key={b.badge.code} style={styles.badge}>
                <Text style={styles.badgeName}>{b.badge.name}</Text>
                <Text style={styles.badgeDate}>{formatDate(b.earned_at)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.sm },
  strip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  stripItem: { flex: 1, alignItems: "center", gap: 2 },
  stripValue: { fontSize: font.md, fontWeight: "700", color: colors.white },
  stripLabel: { fontSize: font.xs, color: colors.muted },
  sortRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exerciseName: { fontSize: font.base, fontWeight: "600", color: colors.white, flexShrink: 1 },
  prCount: { fontSize: font.sm, color: colors.white },
  statRow: { flexDirection: "row", gap: spacing.sm },
  miniStat: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  miniStatValue: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  miniStatLabel: { fontSize: font.xs, color: colors.muted },
  lastPr: { fontSize: font.xs, color: colors.muted },
  badgesWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + "50",
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeName: { fontSize: font.sm, fontWeight: "600", color: colors.accent },
  badgeDate: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
});
