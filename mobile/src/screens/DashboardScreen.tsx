import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Btn from "../components/Btn";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<TabParamList>
>;

function initials(name: string | null | undefined): string {
  if (!name) return "T";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface CardDef {
  key: string;
  label: string;
  value: string;
  warning?: boolean;
  onPress: () => void;
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [showMetrics, setShowMetrics] = useState(false);

  const { data: trainer } = useQuery({ queryKey: ["trainer", "me"], queryFn: api.trainer.me });
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ["dashboard", "stats"], queryFn: api.dashboard.stats });
  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: api.notifications.unreadCount,
    refetchInterval: 60_000,
  });
  const unreadCount = unread?.count ?? 0;

  const quickActions = [
    { label: "Start Workout", onPress: () => navigation.navigate("ClientsList", { pick: true }) },
    { label: "Add Client", onPress: () => navigation.navigate("AddClient") },
    { label: "Programs", onPress: () => navigation.navigate("ProgramsList") },
    {
      label: "Search Clients",
      onPress: () => navigation.navigate("ClientsTab", { autoFocusSearch: true }),
    },
  ];

  const cards: CardDef[] = stats
    ? [
        {
          key: "clients",
          label: "Active clients",
          value: String(stats.active_clients),
          onPress: () => navigation.navigate("ClientsTab", { filter: "active" }),
        },
        {
          key: "today",
          label: "Workouts today",
          value: String(stats.workouts_today),
          onPress: () => navigation.navigate("Activity"),
        },
        {
          key: "week",
          label: "This week",
          value: String(stats.workouts_this_week),
          onPress: () => navigation.navigate("Activity"),
        },
        {
          key: "alltime",
          label: "All-time workouts",
          value: String(stats.workouts_all_time),
          onPress: () => navigation.navigate("Activity"),
        },
        {
          key: "adherence",
          label: "Adherence (30d)",
          value: stats.adherence_pct != null ? `${stats.adherence_pct}%` : "—",
          onPress: () => navigation.navigate("ClientsTab", { filter: "active" }),
        },
        {
          key: "prs",
          label: "PRs (7d)",
          value: String(stats.prs_last_7_days),
          onPress: () => navigation.navigate("RecentPRs"),
        },
        {
          key: "inactive",
          label: "Inactive 7+ days",
          value: String(stats.inactive_clients),
          warning: stats.inactive_clients > 0,
          onPress: () => navigation.navigate("ClientsList", { filter: "inactive" }),
        },
      ]
    : [];

  const maxCategoryCount = Math.max(1, ...(stats?.top_categories.map((c) => c.count) ?? [1]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.muted} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(trainer?.name)}</Text>
          </View>
          <View>
            <Text style={styles.hello}>Welcome back</Text>
            <Text style={styles.trainerName}>{trainer?.name ?? "Trainer"}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Notifications")}>
            <Text style={styles.iconText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("SettingsTab")}>
            <Text style={styles.iconText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {quickActions.map((qa) => (
          <TouchableOpacity key={qa.label} style={styles.quickBtn} onPress={qa.onPress} activeOpacity={0.75}>
            <Text style={styles.quickLabel}>{qa.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && <Spinner />}

      {/* Empty state replaces stats entirely when no clients */}
      {!isLoading && stats?.active_clients === 0 && (
        <EmptyState
          title="Add your first client"
          subtitle="Your dashboard fills in as clients train — stats, PRs, and adherence all show up here."
          action={<Btn label="+ Add Client" onPress={() => navigation.navigate("AddClient")} />}
        />
      )}

      {/* Overview cards */}
      {!isLoading && stats && stats.active_clients > 0 && (
        <>
          <View style={styles.grid}>
            {cards.map((card) => (
              <TouchableOpacity
                key={card.key}
                style={[styles.card, card.warning && styles.cardWarning]}
                onPress={card.onPress}
                activeOpacity={0.75}
              >
                <Text style={[styles.cardValue, card.warning && styles.cardValueWarning]}>
                  {card.value}
                </Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Performance metrics (collapsible) */}
          <TouchableOpacity
            style={styles.metricsToggle}
            onPress={() => setShowMetrics((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={styles.metricsTitle}>Performance Metrics</Text>
            <Text style={styles.metricsChevron}>{showMetrics ? "▾" : "▸"}</Text>
          </TouchableOpacity>

          {showMetrics && (
            <View style={styles.metricsBody}>
              <MetricRow label="Total lifetime workouts" value={String(stats.workouts_all_time)} />
              <MetricRow label="Total lifetime PRs" value={String(stats.lifetime_prs)} />
              <MetricRow
                label="Avg sessions per client"
                value={stats.avg_sessions_per_client != null ? String(stats.avg_sessions_per_client) : "—"}
              />
              <MetricRow label="Hours coached this week" value={`${stats.hours_coached_this_week}h`} />

              {stats.top_categories.length > 0 && (
                <View style={styles.chartWrap}>
                  <Text style={styles.chartTitle}>Most trained (30d, by sets)</Text>
                  {stats.top_categories.map((c) => (
                    <View key={c.category} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {c.category}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barFill, { width: `${(c.count / maxCategoryCount) * 100}%` }]}
                        />
                      </View>
                      <Text style={styles.barCount}>{c.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.base,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.md },
  hello: { color: colors.muted, fontSize: font.xs },
  trainerName: { color: colors.white, fontSize: font.lg, fontWeight: "700" },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 16, color: colors.white },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  quickBtn: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  quickLabel: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  cardWarning: {
    borderColor: colors.danger + "60",
    backgroundColor: colors.dangerDim,
  },
  cardValue: { fontSize: font.xxl, fontWeight: "700", color: colors.white },
  cardValueWarning: { color: colors.danger },
  cardLabel: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  metricsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  metricsTitle: { color: colors.muted, fontSize: font.sm, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  metricsChevron: { color: colors.muted, fontSize: font.md },
  metricsBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.md,
  },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { color: colors.muted, fontSize: font.sm },
  metricValue: { color: colors.white, fontSize: font.sm, fontWeight: "600" },
  chartWrap: { marginTop: spacing.sm, gap: spacing.xs },
  chartTitle: { color: colors.muted, fontSize: font.xs, marginBottom: spacing.xs },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { color: colors.white, fontSize: font.xs, width: 80 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  barCount: { color: colors.muted, fontSize: font.xs, width: 28, textAlign: "right" },
});
