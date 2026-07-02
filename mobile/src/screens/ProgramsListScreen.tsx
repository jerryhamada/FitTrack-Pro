import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramsListScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [assignProgramId, setAssignProgramId] = useState<number | null>(null);

  const { data: programs, isLoading } = useQuery({
    queryKey: ["programs"],
    queryFn: api.programs.list,
  });
  const { data: clients } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
    enabled: assignProgramId !== null,
  });

  const deleteProgram = useMutation({
    mutationFn: (id: number) => api.programs.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programs"] }),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const assign = useMutation({
    mutationFn: (clientId: number) => api.programs.assign(assignProgramId!, clientId),
    onSuccess: (_, clientId) => {
      setAssignProgramId(null);
      navigation.navigate("ClientProfile", { clientId });
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Programs</Text>
          <Btn label="+ New" onPress={() => navigation.navigate("ProgramBuilder", {})} />
        </View>

        {isLoading && <Spinner />}

        {programs?.length === 0 && (
          <EmptyState
            title="No program templates yet"
            subtitle="Build a reusable weekly plan you can assign to any client."
            action={
              <Btn label="+ New Program" onPress={() => navigation.navigate("ProgramBuilder", {})} />
            }
          />
        )}

        {programs?.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.programName}>{p.name}</Text>
                <Text style={styles.programMeta}>
                  {p.day_count} days · created {formatDate(p.created_at)}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <Btn label="Assign" variant="secondary" style={styles.actionBtn} onPress={() => setAssignProgramId(p.id)} />
              <Btn
                label="Edit"
                variant="secondary"
                style={styles.actionBtn}
                onPress={() => navigation.navigate("ProgramBuilder", { programId: p.id })}
              />
              <Btn
                label="Delete"
                variant="danger"
                style={styles.actionBtn}
                onPress={() =>
                  Alert.alert("Delete program", `Delete "${p.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteProgram.mutate(p.id) },
                  ])
                }
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomSheet visible={assignProgramId !== null} onClose={() => setAssignProgramId(null)}>
        <Text style={styles.sheetTitle}>Assign to Client</Text>
        {!clients && <Spinner />}
        {clients?.length === 0 && <Text style={styles.muted}>No active clients yet.</Text>}
        {clients?.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.clientRow}
            onPress={() => assign.mutate(c.id)}
            disabled={assign.isPending}
          >
            <Text style={styles.clientName}>{c.name}</Text>
          </TouchableOpacity>
        ))}
        <Btn label="Cancel" variant="secondary" onPress={() => setAssignProgramId(null)} fullWidth />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  programName: { fontSize: font.base, fontWeight: "600", color: colors.white },
  programMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, height: 36 },
  muted: { fontSize: font.sm, color: colors.muted },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  clientRow: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md },
  clientName: { fontSize: font.base, fontWeight: "500", color: colors.white },
});
