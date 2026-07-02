import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import EmptyState from "../../components/EmptyState";
import Pill from "../../components/Pill";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import { colors, font, radius, spacing } from "../../theme";

export default function PRsTab({ clientId }: { clientId: number }) {
  const { data: prs, isLoading: prsLoading } = useQuery({
    queryKey: ["prs", clientId],
    queryFn: () => api.clients.prs(clientId),
  });
  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ["badges", clientId],
    queryFn: () => api.clients.badges(clientId),
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Badges earned</Text>
        {badgesLoading && <Spinner />}
        {badges?.length === 0 && <Text style={styles.muted}>No badges yet.</Text>}
        <View style={styles.badgesWrap}>
          {badges?.map((b) => (
            <View key={b.badge.code} style={styles.badge}>
              <Text style={styles.badgeName}>{b.badge.name}</Text>
              <Text style={styles.badgeDate}>{formatDate(b.earned_at)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>PR timeline</Text>
        {prsLoading && <Spinner />}
        {prs?.length === 0 && (
          <EmptyState
            title="No PRs yet"
            subtitle="They'll show up automatically as sets are logged."
          />
        )}
        {prs?.map((pr) => (
          <View key={pr.id} style={styles.prRow}>
            <View>
              <Text style={styles.prName}>{pr.exercise_name}</Text>
              <Text style={styles.prDate}>{formatDate(pr.achieved_at)}</Text>
            </View>
            <View style={styles.prRight}>
              <Pill tone="accent">
                {pr.pr_type === "estimated_1rm" ? "Est. 1RM" : "Weight PR"}
              </Pill>
              <Text style={styles.prValue}>
                {pr.value.toFixed(1)} {pr.unit}
                {pr.reps ? ` x ${pr.reps}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.base },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
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
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  prName: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  prDate: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  prRight: { alignItems: "flex-end", gap: 4 },
  prValue: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  muted: { fontSize: font.sm, color: colors.muted },
});
