import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import type { Client } from "../../types";
import { colors, font, radius, spacing } from "../../theme";

export default function ProgressTab({ client }: { client: Client }) {
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [metric, setMetric] = useState<"1rm" | "weight">("1rm");
  const [showExPicker, setShowExPicker] = useState(false);

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.exercises.list(),
  });
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", client.id, exerciseId, metric],
    queryFn: () => api.clients.progress(client.id, exerciseId!, metric),
    enabled: exerciseId !== null,
  });
  const { data: volume, isLoading: volumeLoading } = useQuery({
    queryKey: ["volume-by-category", client.id],
    queryFn: () => api.clients.volumeByCategory(client.id),
  });

  const selectedExercise = exercises?.find((e) => e.id === exerciseId);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Strength over time</Text>

        <TouchableOpacity style={styles.picker} onPress={() => setShowExPicker(!showExPicker)}>
          <Text style={selectedExercise ? styles.pickerSelected : styles.pickerPlaceholder}>
            {selectedExercise ? selectedExercise.name : "Select an exercise..."}
          </Text>
          <Text style={styles.chevron}>{showExPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showExPicker && (
          <View style={styles.exerciseList}>
            {exercises?.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.exerciseOption, e.id === exerciseId && styles.exerciseOptionActive]}
                onPress={() => { setExerciseId(e.id); setShowExPicker(false); }}
              >
                <Text style={[styles.exerciseOptionText, e.id === exerciseId && { color: colors.accent }]}>
                  {e.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.metricRow}>
          {(["1rm", "weight"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.metricBtn, metric === m && styles.metricBtnActive]}
              onPress={() => setMetric(m)}
            >
              <Text style={[styles.metricBtnText, metric === m && styles.metricBtnTextActive]}>
                {m === "1rm" ? "Est. 1RM" : "Top Weight"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {progressLoading && <Spinner />}

        {progress && progress.points.length === 0 && (
          <Text style={styles.muted}>No data yet for this exercise.</Text>
        )}

        {progress && progress.points.length > 0 && (
          <View style={styles.pointsList}>
            {[...progress.points].reverse().slice(0, 20).map((pt, i) => (
              <View key={i} style={styles.pointRow}>
                <Text style={styles.pointDate}>{formatDate(pt.date)}</Text>
                <Text style={styles.pointValue}>
                  {pt.value.toFixed(1)} {progress.unit}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Volume by category</Text>
        {volumeLoading && <Spinner />}
        {volume && volume.points.length === 0 && (
          <Text style={styles.muted}>No volume data yet.</Text>
        )}
        {volume && volume.points.length > 0 && (
          <View style={styles.pointsList}>
            {Object.entries(
              volume.points.reduce<Record<string, number>>((acc, p) => {
                acc[p.category] = (acc[p.category] ?? 0) + p.total_volume;
                return acc;
              }, {})
            ).map(([cat, total]) => (
              <View key={cat} style={styles.pointRow}>
                <Text style={styles.pointDate}>{cat}</Text>
                <Text style={styles.pointValue}>
                  {Math.round(total).toLocaleString()} {volume.unit}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
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
  cardTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  pickerSelected: { fontSize: font.sm, color: colors.white },
  pickerPlaceholder: { fontSize: font.sm, color: colors.muted },
  chevron: { color: colors.muted, fontSize: font.sm },
  exerciseList: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  exerciseOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseOptionActive: { backgroundColor: colors.accentDim },
  exerciseOptionText: { fontSize: font.sm, color: colors.white },
  metricRow: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  metricBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  metricBtnActive: { backgroundColor: colors.accent },
  metricBtnText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
  metricBtnTextActive: { color: "#000" },
  pointsList: { gap: spacing.xs },
  pointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pointDate: { fontSize: font.sm, color: colors.muted },
  pointValue: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  muted: { fontSize: font.sm, color: colors.muted },
});
