import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RecentPRsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: prs, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-prs"],
    queryFn: () => api.dashboard.recentPRs(7),
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={prs ?? []}
        keyExtractor={(pr) => String(pr.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="No PRs this week"
            subtitle="Personal records from the last 7 days will show up here."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("ClientProfile", { clientId: item.client_id })}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.exercise}>{item.exercise_name}</Text>
              <Text style={styles.meta}>
                {item.client_name} · {formatDate(item.achieved_at)}
              </Text>
            </View>
            <View style={styles.valueWrap}>
              <Pill tone="accent">
                {item.pr_type === "estimated_1rm" ? "e1RM" : `${item.reps ?? "?"}RM`}
              </Pill>
              <Text style={styles.value}>
                {item.value % 1 === 0 ? item.value : item.value.toFixed(1)} {item.unit}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.base, gap: spacing.sm },
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
  exercise: { color: colors.white, fontSize: font.base, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  valueWrap: { alignItems: "flex-end", gap: 4 },
  value: { color: colors.white, fontSize: font.base, fontWeight: "700" },
});
