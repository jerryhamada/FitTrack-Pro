import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api, ApiError } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";
import HistoryTab from "./client/HistoryTab";
import NotesTab from "./client/NotesTab";
import OverviewTab from "./client/OverviewTab";
import PRsTab from "./client/PRsTab";
import ProgramsTab from "./client/ProgramsTab";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ClientProfile">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const TABS = ["Overview", "History", "PRs", "Notes", "Programs"] as const;
type Tab = (typeof TABS)[number];

function trainingPhase(programs: { name: string; start_date: string | null; active: boolean }[] | undefined): string | null {
  const active = programs?.find((p) => p.active);
  if (!active) return null;
  if (!active.start_date) return active.name;
  const days = Math.floor((Date.now() - new Date(active.start_date).getTime()) / 86_400_000);
  if (days < 0) return active.name;
  return `${active.name} — Week ${Math.floor(days / 7) + 1}`;
}

export default function ClientProfileScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { clientId } = route.params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.clients.get(clientId),
    enabled: !!clientId,
  });
  const { data: programs } = useQuery({
    queryKey: ["client-programs", clientId],
    queryFn: () => api.clients.programs(clientId),
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
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const deleteClient = useMutation({
    mutationFn: () => api.clients.delete(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigation.navigate("MainTabs");
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.status === 409
          ? (e as ApiError).message
          : (e as Error).message;
      Alert.alert("Can't delete", msg);
    },
    meta: { skipGlobalToast: true },
  });

  if (isLoading || !client) return <Spinner />;

  const phase = trainingPhase(programs);
  const injuries = client.injuries_limitations?.trim() || null;

  const confirmArchive = () =>
    Alert.alert("Deactivate client", `Archive ${client.name}? They stay in your history.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => archiveClient.mutate() },
    ]);

  const confirmDelete = () =>
    Alert.alert("Delete client", `Permanently delete ${client.name}? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteClient.mutate() },
    ]);

  return (
    <View style={styles.container}>
      {/* Persistent header */}
      <View style={styles.header}>
        <View style={styles.identityRow}>
          {client.photo_url ? (
            <Image source={{ uri: client.photo_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.clientName} numberOfLines={1}>
                {client.name}
              </Text>
              {client.status === "archived" && <Pill tone="danger">Archived</Pill>}
            </View>
            {phase && (
              <Text style={styles.phase} numberOfLines={1}>
                {phase}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </TouchableOpacity>
        </View>

        {injuries && (
          <TouchableOpacity
            style={styles.injuryBadge}
            onPress={() => Alert.alert("Injuries / limitations", injuries)}
            activeOpacity={0.75}
          >
            <Text style={styles.injuryBadgeText} numberOfLines={1}>
              ⚠ {injuries}
            </Text>
          </TouchableOpacity>
        )}

        <Btn
          label={startSession.isPending ? "Starting..." : "Start Workout"}
          onPress={() => startSession.mutate()}
          loading={startSession.isPending}
          fullWidth
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabItem}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === "Overview" && (
          <OverviewTab client={client} onStartWorkout={() => startSession.mutate()} />
        )}
        {tab === "History" && <HistoryTab client={client} />}
        {tab === "PRs" && <PRsTab clientId={clientId} />}
        {tab === "Notes" && <NotesTab clientId={clientId} />}
        {tab === "Programs" && <ProgramsTab client={client} />}
      </View>

      {/* Overflow menu */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.sheetTitle}>{client.name}</Text>
        <TouchableOpacity
          style={styles.sheetOption}
          onPress={() => {
            setMenuOpen(false);
            setTab("Overview");
          }}
        >
          <Text style={styles.sheetOptionText}>Edit client info</Text>
          <Text style={styles.sheetOptionHint}>Opens the Overview tab — tap Edit on the info card</Text>
        </TouchableOpacity>
        {client.status === "active" && (
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => {
              setMenuOpen(false);
              confirmArchive();
            }}
          >
            <Text style={styles.sheetOptionText}>Deactivate client</Text>
            <Text style={styles.sheetOptionHint}>Archives them — history is kept</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.sheetOption}
          onPress={() => {
            setMenuOpen(false);
            confirmDelete();
          }}
        >
          <Text style={[styles.sheetOptionText, { color: colors.danger }]}>Delete client</Text>
          <Text style={styles.sheetOptionHint}>Only possible before any workouts are logged</Text>
        </TouchableOpacity>
      </BottomSheet>
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  clientName: { fontSize: font.xl, fontWeight: "700", color: colors.white, flexShrink: 1 },
  phase: { fontSize: font.xs, color: colors.accent, fontWeight: "500", marginTop: 2 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnText: { color: colors.white, fontSize: font.lg, lineHeight: 20 },
  injuryBadge: {
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger + "50",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  injuryBadgeText: { color: colors.danger, fontSize: font.xs, fontWeight: "600" },
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 44, flexGrow: 0 },
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
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  sheetOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 },
  sheetOptionText: { fontSize: font.base, color: colors.white, fontWeight: "500" },
  sheetOptionHint: { fontSize: font.xs, color: colors.muted },
});
