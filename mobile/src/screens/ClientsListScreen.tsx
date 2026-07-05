import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { daysAgo } from "../lib/utils";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";
import type { ClientPulse } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "ClientsList">;

export default function ClientsListScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const { params } = useRoute<Route>();
  const pick = params?.pick ?? false;
  const inactiveOnly = params?.filter === "inactive";
  const [search, setSearch] = useState("");

  useEffect(() => {
    navigation.setOptions({
      title: pick ? "Start Workout" : inactiveOnly ? "Needs Attention" : "Clients",
    });
  }, [navigation, pick, inactiveOnly]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
  });

  const startSession = useMutation({
    mutationFn: (clientId: number) => api.sessions.start(clientId),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ["sessions", "active"] });
      navigation.replace("SessionLog", { sessionId: session.id });
    },
  });

  const filtered = useMemo(() => {
    let list = clients ?? [];
    if (inactiveOnly) list = list.filter((c) => c.is_stale);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
    return list;
  }, [clients, inactiveOnly, search]);

  const onPress = (client: ClientPulse) => {
    if (pick) {
      if (!startSession.isPending) startSession.mutate(client.id);
    } else {
      navigation.navigate("ClientProfile", { clientId: client.id });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChangeText={setSearch}
          autoFocus={params?.autoFocusSearch ?? false}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {pick && <Text style={styles.pickHint}>Pick a client to start logging a workout.</Text>}

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title={search ? "No matches" : inactiveOnly ? "Everyone is on track" : "No clients yet"}
              subtitle={
                search
                  ? "Try a different name or email."
                  : inactiveOnly
                    ? "No active clients have gone 7+ days without a session."
                    : "Add a client to get started."
              }
            />
          }
          renderItem={({ item }) => {
            const last = daysAgo(item.last_session_at);
            return (
              <TouchableOpacity style={styles.row} onPress={() => onPress(item)} activeOpacity={0.75}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.last_session_at ? `Last session ${last}d ago` : "No sessions yet"}
                  </Text>
                </View>
                {item.is_stale && <Pill tone="danger">7d+</Pill>}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: spacing.base, paddingBottom: spacing.sm },
  pickHint: {
    fontSize: font.sm,
    color: colors.muted,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.base },
  name: { color: colors.white, fontSize: font.base, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
});
