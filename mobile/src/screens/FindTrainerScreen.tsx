import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { colors, font, radius, spacing } from "../theme";
import type { TrainerSearchResult } from "../types";

const SEARCH_DEBOUNCE_MS = 300;

function TrainerAvatar({ trainer }: { trainer: TrainerSearchResult }) {
  if (trainer.logo_url) {
    return <Image source={{ uri: trainer.logo_url }} style={styles.avatar} />;
  }
  const initials = trainer.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{initials || "?"}</Text>
    </View>
  );
}

/**
 * Client-side "Find your trainer" search. Used in two places:
 * - right after a client signs up without an invite (onboarding), and
 * - from the client Account tab for anyone who skipped ("link later in Settings").
 * `onDone` fires when the user either sends a request or skips.
 */
export default function FindTrainerScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery({
    queryKey: ["trainer-search", debounced],
    queryFn: () => api.clientPortal.trainerSearch(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const request = useMutation({
    mutationFn: (trainerId: number) => api.clientPortal.requestLink(trainerId),
    onSuccess: (_data, _trainerId) => {
      qc.invalidateQueries({ queryKey: ["whoami"] });
      Alert.alert(
        "Request sent",
        "Your trainer will see your request and can accept it from their app.",
        [{ text: "OK", onPress: onDone }]
      );
    },
  });

  const joinByCode = useMutation({
    mutationFn: (joinCode: string) => api.clientPortal.joinByCode(joinCode),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["whoami"] });
      const business = res.trainer_business ? ` (${res.trainer_business})` : "";
      Alert.alert(
        "You're connected!",
        `You've joined ${res.trainer_name ?? "your trainer"}${business}.`,
        [{ text: "Let's go", onPress: onDone }]
      );
    },
    onError: (err) => Alert.alert("Couldn't join", (err as Error).message),
  });

  function confirmRequest(trainer: TrainerSearchResult) {
    const business = trainer.business_name ? ` (${trainer.business_name})` : "";
    Alert.alert(
      "Send request to connect?",
      `${trainer.name}${business} will be asked to add you as their client.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send request", onPress: () => request.mutate(trainer.trainer_id) },
      ]
    );
  }

  const showResults = debounced.length >= 2;
  const results = search.data ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.xl }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Find your trainer</Text>
        <Text style={styles.subtitle}>Search by name, or enter your trainer's code</Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Trainer or business name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.codeRow}>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Have a trainer code?"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        <TouchableOpacity
          style={[styles.joinBtn, (code.trim().length === 0 || joinByCode.isPending) && styles.joinBtnDisabled]}
          disabled={code.trim().length === 0 || joinByCode.isPending}
          onPress={() => joinByCode.mutate(code.trim())}
        >
          {joinByCode.isPending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.joinBtnText}>Join</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.results}>
        {!showResults ? (
          <Text style={styles.hint}>Type at least two letters to search.</Text>
        ) : search.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No trainers found</Text>
            <Text style={styles.emptyText}>
              Don't see your trainer? You can skip for now and link up later in Settings.
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(t) => String(t.trainer_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => confirmRequest(item)}
                disabled={request.isPending}
                activeOpacity={0.7}
              >
                <TrainerAvatar trainer={item} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.business_name && <Text style={styles.rowBusiness}>{item.business_name}</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <TouchableOpacity
        onPress={onDone}
        style={[styles.skipBtn, { paddingBottom: insets.bottom + spacing.base }]}
        disabled={request.isPending}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  subtitle: { fontSize: font.sm, color: colors.muted },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.white, fontSize: font.base, height: "100%" },
  codeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.white,
    fontSize: font.base,
    letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { color: "#000", fontSize: font.sm, fontWeight: "700" },
  results: { flex: 1, marginTop: spacing.base },
  hint: { fontSize: font.sm, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: font.md, fontWeight: "600", color: colors.white },
  emptyText: { fontSize: font.sm, color: colors.muted, textAlign: "center", lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: colors.accent, fontSize: font.sm, fontWeight: "700" },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: font.base, fontWeight: "600", color: colors.white },
  rowBusiness: { fontSize: font.xs, color: colors.muted },
  skipBtn: { alignItems: "center", paddingTop: spacing.md },
  skipText: { fontSize: font.sm, color: colors.muted, textDecorationLine: "underline" },
});
