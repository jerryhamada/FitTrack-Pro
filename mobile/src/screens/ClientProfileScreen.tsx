import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Btn from "../components/Btn";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";
import OverviewTab from "./client/OverviewTab";
import PRsTab from "./client/PRsTab";
import ProgressTab from "./client/ProgressTab";
import ProgramsTab from "./client/ProgramsTab";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ClientProfile">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const TABS = ["Overview", "Programs", "Progress", "PRs"] as const;
type Tab = (typeof TABS)[number];

export default function ClientProfileScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { clientId } = route.params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.clients.get(clientId),
    enabled: !!clientId,
  });

  const startSession = useMutation({
    mutationFn: () => api.sessions.start(clientId),
    onSuccess: (session) => navigation.navigate("SessionLog", { sessionId: session.id }),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const archiveClient = useMutation({
    mutationFn: () => api.clients.archive(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigation.navigate("MainTabs");
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading || !client) return <Spinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.clientName}>{client.name}</Text>
            {client.status === "archived" && <Pill tone="danger">Archived</Pill>}
          </View>
          <Text style={styles.clientEmail}>{client.email}</Text>
        </View>
        <View style={styles.btnRow}>
          <Btn
            label={startSession.isPending ? "Starting..." : "Log Session"}
            onPress={() => startSession.mutate()}
            loading={startSession.isPending}
          />
          {client.status === "active" && (
            <Btn
              label="Archive"
              variant="secondary"
              onPress={() =>
                Alert.alert("Archive client", `Archive ${client.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Archive", style: "destructive", onPress: () => archiveClient.mutate() },
                ])
              }
            />
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabItem}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === "Overview" && <OverviewTab client={client} />}
        {tab === "Programs" && <ProgramsTab client={client} />}
        {tab === "Progress" && <ProgressTab client={client} />}
        {tab === "PRs" && <PRsTab clientId={clientId} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  clientName: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  clientEmail: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  btnRow: { flexDirection: "row", gap: spacing.sm },
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 44 },
  tabBarContent: { paddingHorizontal: spacing.base, gap: spacing.xs },
  tabItem: { alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: 2 },
  tabText: { fontSize: font.sm, fontWeight: "500", color: colors.muted, lineHeight: 40 },
  tabTextActive: { color: colors.accent, fontWeight: "600" },
  tabUnderline: {
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
