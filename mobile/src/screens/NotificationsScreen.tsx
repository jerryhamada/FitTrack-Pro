import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";
import type { Notification, NotificationType } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = "all" | "unread";

// Urgency palette: red/orange = needs action, gold = positive (PR), blue = info.
const TYPE_META: Record<NotificationType, { icon: string; color: string }> = {
  client_inactive: { icon: "⚠️", color: "#f59e0b" },
  missed_workout: { icon: "❌", color: colors.danger },
  new_pr: { icon: "🏆", color: "#eab308" },
  session_reminder: { icon: "📅", color: "#3b82f6" },
  client_link_request: { icon: "🤝", color: colors.accent },
};

function relativeTime(iso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayBucket(iso: string, now: Date): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const now = Date.now();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.notifications.list(false),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => api.notifications.markRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: invalidate,
  });

  const sections = useMemo(() => {
    const list = (notifications ?? []).filter((n) => (filter === "unread" ? !n.is_read : true));
    const nowDate = new Date();
    const buckets = new Map<string, Notification[]>();
    for (const n of list) {
      const key = dayBucket(n.created_at, nowDate);
      const arr = buckets.get(key) ?? [];
      arr.push(n);
      buckets.set(key, arr);
    }
    return BUCKET_ORDER.filter((b) => buckets.has(b)).map((title) => ({
      title,
      data: buckets.get(title)!,
    }));
  }, [notifications, filter]);

  function routeTo(n: Notification) {
    switch (n.type) {
      case "new_pr":
        if (n.client_id != null)
          navigation.navigate("ClientProfile", { clientId: n.client_id, initialTab: "PRs" });
        break;
      case "client_inactive":
        if (n.client_id != null) navigation.navigate("ClientProfile", { clientId: n.client_id });
        break;
      case "session_reminder":
      case "missed_workout":
        // Session Detail lives on the Schedule tab; open it there.
        navigation.navigate("MainTabs");
        break;
    }
  }

  const onPress = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    routeTo(n);
  };

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  if (isLoading) return <Spinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tabs}>
          {(["all", "unread"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.tab, filter === f && styles.tabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.tabText, filter === f && { color: "#000" }]}>
                {f === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => markAll.mutate()}
          disabled={unreadCount === 0 || markAll.isPending}
        >
          <Text style={[styles.markAll, unreadCount === 0 && { color: colors.border }]}>
            Mark all as read
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            title="You're all caught up."
            subtitle={filter === "unread" ? "No unread notifications." : "New alerts will show up here."}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type];
          return (
            <TouchableOpacity
              style={[styles.row, !item.is_read && styles.rowUnread]}
              onPress={() => onPress(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: meta.color + "22" }]}>
                <Text style={styles.icon}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.message, !item.is_read && { color: colors.white }]}>
                  {item.message}
                </Text>
                <Text style={styles.time}>{relativeTime(item.created_at, now)}</Text>
              </View>
              {!item.is_read && <View style={[styles.dot, { backgroundColor: meta.color }]} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
  markAll: { fontSize: font.sm, color: colors.accent, fontWeight: "500" },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl, gap: spacing.xs },
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowUnread: { borderColor: colors.borderLight, backgroundColor: colors.surface },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 18 },
  message: { fontSize: font.sm, color: colors.muted, lineHeight: 19 },
  time: { fontSize: font.xs, color: colors.muted, marginTop: 3, opacity: 0.7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
