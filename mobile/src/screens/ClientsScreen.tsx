import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useRoute, useNavigation, type CompositeNavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { daysAgo } from "../lib/utils";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";
import type { ClientPulse, GoalType } from "../types";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<TabParamList>
>;
type Route = RouteProp<TabParamList, "ClientsTab">;

type StatusFilter = "all" | "active" | "inactive";
type FreqFilter = "any" | "1" | "2" | "3plus";
type SortKey = "name" | "recent" | "streak";
type SheetKind = "goal" | "freq" | "sort" | null;

const GOAL_TYPES: GoalType[] = ["strength", "hypertrophy", "fat_loss", "endurance", "general_fitness"];

const GOAL_LABELS: Record<GoalType, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  fat_loss: "Fat Loss",
  endurance: "Endurance",
  general_fitness: "General Fitness",
};

const FREQ_OPTIONS: { key: FreqFilter; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "1", label: "1x/wk" },
  { key: "2", label: "2x/wk" },
  { key: "3plus", label: "3+/wk" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name A–Z" },
  { key: "recent", label: "Last workout" },
  { key: "streak", label: "Streak" },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

export default function ClientsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const searchRef = useRef<TextInput>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [goalFilter, setGoalFilter] = useState<GoalType | null>(null);
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("any");
  const [sort, setSort] = useState<SortKey>("name");
  const [openSheet, setOpenSheet] = useState<SheetKind>(null);

  useEffect(() => {
    if (params?.filter) setStatusFilter(params.filter);
    if (params?.autoFocusSearch) searchRef.current?.focus();
  }, [params]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api.clients.list("all"),
  });

  const startSession = useMutation({
    mutationFn: (clientId: number) => api.sessions.start(clientId),
    onSuccess: (session) => navigation.navigate("SessionLog", { sessionId: session.id }),
    onError: (err) => Alert.alert("Error", (err as Error).message),
  });

  const filtered = useMemo(() => {
    let list = clients ?? [];
    if (statusFilter === "active") list = list.filter((c) => c.status === "active");
    if (statusFilter === "inactive") list = list.filter((c) => c.status === "archived");
    if (goalFilter) list = list.filter((c) => c.goal_type === goalFilter);
    if (freqFilter === "1") list = list.filter((c) => c.training_frequency_target === 1);
    if (freqFilter === "2") list = list.filter((c) => c.training_frequency_target === 2);
    if (freqFilter === "3plus")
      list = list.filter((c) => c.training_frequency_target != null && c.training_frequency_target >= 3);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "recent") {
      sorted.sort((a, b) => {
        const ta = a.last_session_at ? new Date(a.last_session_at).getTime() : 0;
        const tb = b.last_session_at ? new Date(b.last_session_at).getTime() : 0;
        return tb - ta;
      });
    } else {
      sorted.sort((a, b) => b.streak_weeks - a.streak_weeks);
    }
    return sorted;
  }, [clients, statusFilter, goalFilter, freqFilter, search, sort]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setGoalFilter(null);
    setFreqFilter("any");
  };

  const renderCard = ({ item }: { item: ClientPulse }) => {
    const archived = item.status === "archived";
    const last = daysAgo(item.last_session_at);
    const isStarting = startSession.isPending && startSession.variables === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, archived && styles.cardArchived]}
        onPress={() => navigation.navigate("ClientProfile", { clientId: item.id })}
        activeOpacity={0.75}
      >
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {archived && <Pill>Inactive</Pill>}
          </View>
          {item.training_phase != null && (
            <Text style={styles.phase} numberOfLines={1}>
              {item.training_phase}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.meta, item.is_stale && styles.metaStale]}>
              {last != null ? `${last}d ago` : "No sessions yet"}
            </Text>
            {item.is_stale && <Pill tone="danger">7d+</Pill>}
          </View>
          {item.streak_weeks > 0 && (
            <Text style={styles.streak}>🔥 {item.streak_weeks} week streak</Text>
          )}
          {item.goal_type != null && (
            <View style={styles.goalRow}>
              <Pill tone="accent">{GOAL_LABELS[item.goal_type]}</Pill>
            </View>
          )}
        </View>
        {!archived && (
          <TouchableOpacity
            style={[styles.startBtn, startSession.isPending && styles.startBtnDisabled]}
            disabled={startSession.isPending}
            onPress={() => {
              if (!startSession.isPending) startSession.mutate(item.id);
            }}
            activeOpacity={0.75}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.startBtnText}>Start Workout</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Clients</Text>
        <Btn label="+ Add Client" onPress={() => navigation.navigate("AddClient")} />
      </View>

      <View style={styles.searchWrap}>
        <Input
          ref={searchRef}
          placeholder="Search by name or email..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.filterChip, statusFilter === s.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(s.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === s.key && styles.filterChipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chipRow}>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpenSheet("goal")}>
          <Text style={styles.pickerBtnText} numberOfLines={1}>
            Goal: {goalFilter ? GOAL_LABELS[goalFilter] : "Any"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpenSheet("freq")}>
          <Text style={styles.pickerBtnText} numberOfLines={1}>
            Freq: {FREQ_OPTIONS.find((f) => f.key === freqFilter)?.label}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpenSheet("sort")}>
          <Text style={styles.pickerBtnText} numberOfLines={1}>
            Sort: {SORT_OPTIONS.find((s) => s.key === sort)?.label}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderCard}
          ListEmptyComponent={
            (clients?.length ?? 0) === 0 ? (
              <EmptyState
                title="Add your first client"
                subtitle="Your roster lives here — add a client to get started."
                action={<Btn label="+ Add Client" onPress={() => navigation.navigate("AddClient")} />}
              />
            ) : (
              <EmptyState
                title="No clients match your filters"
                subtitle="Try a different search or loosen the filters."
                action={
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={styles.clearFilters}>Clear filters</Text>
                  </TouchableOpacity>
                }
              />
            )
          }
        />
      )}

      <BottomSheet visible={openSheet === "goal"} onClose={() => setOpenSheet(null)}>
        <Text style={styles.sheetTitle}>Filter by goal</Text>
        <TouchableOpacity
          style={[styles.sheetOption, !goalFilter && styles.sheetOptionActive]}
          onPress={() => {
            setGoalFilter(null);
            setOpenSheet(null);
          }}
        >
          <Text style={[styles.sheetOptionText, !goalFilter && { color: colors.accent }]}>Any</Text>
        </TouchableOpacity>
        {GOAL_TYPES.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.sheetOption, goalFilter === g && styles.sheetOptionActive]}
            onPress={() => {
              setGoalFilter(g);
              setOpenSheet(null);
            }}
          >
            <Text style={[styles.sheetOptionText, goalFilter === g && { color: colors.accent }]}>
              {GOAL_LABELS[g]}
            </Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet visible={openSheet === "freq"} onClose={() => setOpenSheet(null)}>
        <Text style={styles.sheetTitle}>Filter by target frequency</Text>
        {FREQ_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.sheetOption, freqFilter === f.key && styles.sheetOptionActive]}
            onPress={() => {
              setFreqFilter(f.key);
              setOpenSheet(null);
            }}
          >
            <Text style={[styles.sheetOptionText, freqFilter === f.key && { color: colors.accent }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet visible={openSheet === "sort"} onClose={() => setOpenSheet(null)}>
        <Text style={styles.sheetTitle}>Sort by</Text>
        {SORT_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sheetOption, sort === s.key && styles.sheetOptionActive]}
            onPress={() => {
              setSort(s.key);
              setOpenSheet(null);
            }}
          >
            <Text style={[styles.sheetOptionText, sort === s.key && { color: colors.accent }]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  searchWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  filterChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  filterChipActive: { backgroundColor: colors.accent },
  filterChipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  filterChipTextActive: { color: "#000" },
  pickerBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
  },
  pickerBtnText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  cardArchived: { opacity: 0.55 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.base },
  cardBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.white, fontSize: font.base, fontWeight: "600", flexShrink: 1 },
  phase: { color: colors.accent, fontSize: font.xs, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { color: colors.muted, fontSize: font.xs },
  metaStale: { color: colors.danger },
  streak: { color: colors.white, fontSize: font.xs },
  goalRow: { flexDirection: "row", marginTop: 2 },
  startBtn: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 84,
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: {
    color: colors.accent,
    fontSize: font.xs,
    fontWeight: "600",
    textAlign: "center",
  },
  clearFilters: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  sheetOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetOptionActive: { backgroundColor: colors.accentDim },
  sheetOptionText: { fontSize: font.sm, color: colors.white },
});
