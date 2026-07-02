import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../../components/BottomSheet";
import Btn from "../../components/Btn";
import EmptyState from "../../components/EmptyState";
import Pill from "../../components/Pill";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import type { Client } from "../../types";
import type { RootStackParamList } from "../../navigation/types";
import { colors, font, radius, spacing } from "../../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramsTab({ client }: { client: Client }) {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: clientPrograms, isLoading } = useQuery({
    queryKey: ["client-programs", client.id],
    queryFn: () => api.clients.programs(client.id),
  });
  const { data: templates } = useQuery({
    queryKey: ["programs"],
    queryFn: api.programs.list,
    enabled: assignOpen,
  });

  const assign = useMutation({
    mutationFn: (programId: number) => api.programs.assign(programId, client.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-programs", client.id] });
      setAssignOpen(false);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const startFromDay = useMutation({
    mutationFn: (vars: { dayId: number; label: string }) =>
      api.sessions.start(client.id, vars.dayId, vars.label),
    onSuccess: (session) => navigation.navigate("SessionLog", { sessionId: session.id }),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading) return <Spinner />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Btn label="+ Assign a Program" variant="secondary" onPress={() => setAssignOpen(true)} />

      {clientPrograms?.length === 0 && (
        <EmptyState
          title="No programs assigned"
          subtitle="Assign a template or log freeform sessions instead."
        />
      )}

      {clientPrograms?.map((cp) => (
        <View key={cp.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.programName}>{cp.name}</Text>
            {cp.active && <Pill tone="accent">Active</Pill>}
          </View>
          <View style={styles.daysList}>
            {cp.days.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={styles.dayRow}
                onPress={() => startFromDay.mutate({ dayId: day.id, label: day.label })}
              >
                <View>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Text style={styles.dayCount}>{day.exercises.length} exercises</Text>
                </View>
                <Text style={styles.startBtn}>Start →</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <BottomSheet visible={assignOpen} onClose={() => setAssignOpen(false)}>
        <Text style={styles.sheetTitle}>Assign a Program</Text>
        {!templates && <Spinner />}
        {templates?.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.templateRow}
            onPress={() => assign.mutate(t.id)}
            disabled={assign.isPending}
          >
            <Text style={styles.templateName}>{t.name}</Text>
            <Text style={styles.templateDays}>{t.day_count} days</Text>
          </TouchableOpacity>
        ))}
        {templates?.length === 0 && (
          <Text style={styles.muted}>No programs yet. Create one in the Programs tab.</Text>
        )}
        <Btn label="Cancel" variant="secondary" onPress={() => setAssignOpen(false)} />
      </BottomSheet>
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
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  programName: { fontSize: font.base, fontWeight: "600", color: colors.white },
  daysList: { gap: spacing.xs },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  dayLabel: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  dayCount: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  startBtn: { fontSize: font.sm, color: colors.accent, fontWeight: "600" },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  templateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  templateName: { fontSize: font.base, fontWeight: "500", color: colors.white },
  templateDays: { fontSize: font.sm, color: colors.muted },
  muted: { fontSize: font.sm, color: colors.muted },
});
