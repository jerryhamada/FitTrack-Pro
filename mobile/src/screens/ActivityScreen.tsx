import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { ActivityEvent } from "../types";
import { colors, font, radius, spacing } from "../theme";

const LABELS: Record<ActivityEvent["event_type"], string> = {
  session_logged: "Session logged",
  pr_hit: "PR hit",
  invite_sent: "Invite sent",
  invite_accepted: "Invite accepted",
  badge_earned: "Badge earned",
  client_added: "Client added",
};

export default function ActivityScreen() {
  const [clientId, setClientId] = useState<number | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
  });
  const { data: events, isLoading } = useQuery({
    queryKey: ["activity", clientId],
    queryFn: () =>
      api.activity.list({ client_id: clientId ?? undefined, limit: 100 }),
  });

  const selectedClient = clients?.find((c) => c.id === clientId);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(!showFilter)}>
          <Text style={styles.filterBtnText}>
            {selectedClient ? selectedClient.name : "All clients"} ▾
          </Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={showFilter} onClose={() => setShowFilter(false)}>
        <Text style={styles.sheetTitle}>Filter by client</Text>
        <TouchableOpacity
          style={[styles.filterOption, !clientId && styles.filterOptionActive]}
          onPress={() => { setClientId(null); setShowFilter(false); }}
        >
          <Text style={styles.filterOptionText}>All clients</Text>
        </TouchableOpacity>
        {clients?.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.filterOption, clientId === c.id && styles.filterOptionActive]}
            onPress={() => { setClientId(c.id); setShowFilter(false); }}
          >
            <Text style={[styles.filterOptionText, clientId === c.id && { color: colors.accent }]}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {isLoading && <Spinner />}

      {events?.length === 0 && (
        <EmptyState
          title="No activity yet"
          subtitle="Sessions, PRs and invites will show up here."
        />
      )}

      {events?.map((e) => (
        <View key={e.id} style={styles.eventRow}>
          <View style={styles.dot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eventType}>{LABELS[e.event_type]}</Text>
            <Text style={styles.eventMeta}>
              {e.client_name ? `${e.client_name} · ` : ""}
              {new Date(e.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  filterBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterBtnText: { fontSize: font.sm, color: colors.white },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  filterOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterOptionActive: { backgroundColor: colors.accentDim },
  filterOptionText: { fontSize: font.sm, color: colors.white },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 5,
  },
  eventType: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  eventMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
});
