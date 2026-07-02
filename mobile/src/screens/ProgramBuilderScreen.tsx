import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { Unit } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ProgramBuilder">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface BuilderExercise {
  exercise_id: number | null;
  order_index: number;
  target_sets?: number;
  target_reps?: string;
  target_weight?: number;
  target_weight_unit?: Unit;
  target_rpe?: number;
  target_rest_seconds?: number;
  notes?: string;
}
interface BuilderDay {
  label: string;
  order_index: number;
  exercises: BuilderExercise[];
}

export default function ProgramBuilderScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { programId } = route.params;
  const isEdit = !!programId;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<BuilderDay[]>([
    { label: "Day 1", order_index: 0, exercises: [] },
  ]);
  const [activeDay, setActiveDay] = useState(0);
  const [showExPicker, setShowExPicker] = useState<number | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.programs.get(programId!),
    enabled: isEdit,
  });
  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.exercises.list(),
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setDays(
        existing.days.map((d) => ({
          label: d.label,
          order_index: d.order_index,
          exercises: d.exercises.map((e) => ({
            exercise_id: e.exercise_id,
            order_index: e.order_index,
            target_sets: e.target_sets ?? undefined,
            target_reps: e.target_reps ?? undefined,
            target_weight: e.target_weight ?? undefined,
            target_weight_unit: e.target_weight_unit ?? undefined,
            target_rpe: e.target_rpe ?? undefined,
            target_rest_seconds: e.target_rest_seconds ?? undefined,
            notes: e.notes ?? undefined,
          })),
        }))
      );
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        days: days.map((d, i) => ({
          label: d.label,
          order_index: i,
          exercises: d.exercises
            .filter((e) => e.exercise_id !== null)
            .map((e, j) => ({ ...e, order_index: j, exercise_id: e.exercise_id as number })),
        })),
      };
      return isEdit
        ? api.programs.update(programId!, payload)
        : api.programs.create(payload);
    },
    onSuccess: () => navigation.navigate("ProgramsList"),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  function addDay() {
    setDays((prev) => {
      setActiveDay(prev.length);
      return [...prev, { label: `Day ${prev.length + 1}`, order_index: prev.length, exercises: [] }];
    });
  }

  function addExercise() {
    setDays((prev) =>
      prev.map((d, i) =>
        i === activeDay
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                { exercise_id: null, order_index: d.exercises.length },
              ],
            }
          : d
      )
    );
  }

  function removeExercise(idx: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === activeDay
          ? { ...d, exercises: d.exercises.filter((_, j) => j !== idx) }
          : d
      )
    );
  }

  function updateExercise(idx: number, patch: Partial<BuilderExercise>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === activeDay
          ? { ...d, exercises: d.exercises.map((e, j) => (j === idx ? { ...e, ...patch } : e)) }
          : d
      )
    );
  }

  if (isLoading) return <Spinner />;

  const day = days[activeDay];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit Program" : "New Program"}</Text>

      <Input
        label="Program name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. 4-Day Upper/Lower"
      />
      <Input
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Brief overview..."
      />

      <View>
        <Text style={styles.sectionLabel}>Days</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayTab, i === activeDay && styles.dayTabActive]}
              onPress={() => setActiveDay(i)}
            >
              <Text style={[styles.dayTabText, i === activeDay && styles.dayTabTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
            <Text style={styles.addDayBtnText}>+ Day</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {day && (
        <View style={styles.daySection}>
          <Input
            label="Day label"
            value={day.label}
            onChangeText={(v) =>
              setDays((prev) => prev.map((d, i) => (i === activeDay ? { ...d, label: v } : d)))
            }
          />

          <Text style={styles.sectionLabel}>Exercises</Text>

          {day.exercises.map((ex, idx) => {
            const selectedEx = exercises?.find((e) => e.id === ex.exercise_id);
            return (
              <View key={idx} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Text style={styles.exerciseNum}>Exercise {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeExercise(idx)}>
                    <Text style={styles.removeBtn}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.exPicker}
                  onPress={() => setShowExPicker(showExPicker === idx ? null : idx)}
                >
                  <Text style={selectedEx ? styles.exPickerSelected : styles.exPickerPlaceholder}>
                    {selectedEx ? selectedEx.name : "Select exercise..."}
                  </Text>
                  <Text style={styles.chevron}>{showExPicker === idx ? "▲" : "▼"}</Text>
                </TouchableOpacity>

                {showExPicker === idx && (
                  <ScrollView style={styles.exList} nestedScrollEnabled>
                    {exercises?.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        style={styles.exOption}
                        onPress={() => {
                          updateExercise(idx, { exercise_id: e.id });
                          setShowExPicker(null);
                        }}
                      >
                        <Text style={styles.exOptionText}>{e.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.exFields}>
                  <View style={styles.exFieldHalf}>
                    <Text style={styles.fieldLabel}>Sets</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="number-pad"
                      value={ex.target_sets?.toString() ?? ""}
                      onChangeText={(v) => updateExercise(idx, { target_sets: v ? Number(v) : undefined })}
                      placeholderTextColor={colors.muted}
                      placeholder="3"
                    />
                  </View>
                  <View style={styles.exFieldHalf}>
                    <Text style={styles.fieldLabel}>Reps</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={ex.target_reps ?? ""}
                      onChangeText={(v) => updateExercise(idx, { target_reps: v || undefined })}
                      placeholderTextColor={colors.muted}
                      placeholder="8-12"
                    />
                  </View>
                  <View style={styles.exFieldHalf}>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="decimal-pad"
                      value={ex.target_weight?.toString() ?? ""}
                      onChangeText={(v) => updateExercise(idx, { target_weight: v ? Number(v) : undefined })}
                      placeholderTextColor={colors.muted}
                      placeholder="135"
                    />
                  </View>
                  <View style={styles.exFieldHalf}>
                    <Text style={styles.fieldLabel}>RPE</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="decimal-pad"
                      value={ex.target_rpe?.toString() ?? ""}
                      onChangeText={(v) => updateExercise(idx, { target_rpe: v ? Number(v) : undefined })}
                      placeholderTextColor={colors.muted}
                      placeholder="7"
                    />
                  </View>
                </View>
              </View>
            );
          })}

          <Btn label="+ Add Exercise" variant="secondary" onPress={addExercise} fullWidth />
        </View>
      )}

      <Btn
        label={save.isPending ? "Saving..." : isEdit ? "Save changes" : "Create Program"}
        onPress={() => {
          if (!name.trim()) {
            Alert.alert("Name required", "Give your program a name.");
            return;
          }
          save.mutate();
        }}
        loading={save.isPending}
        disabled={!name.trim()}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  sectionLabel: { fontSize: font.sm, fontWeight: "600", color: colors.muted, marginBottom: spacing.sm },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabActive: { backgroundColor: colors.accentDim, borderColor: colors.accent + "60" },
  dayTabText: { fontSize: font.sm, fontWeight: "500", color: colors.muted },
  dayTabTextActive: { color: colors.accent },
  addDayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  addDayBtnText: { fontSize: font.sm, color: colors.muted },
  daySection: { gap: spacing.sm },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseCardHeader: { flexDirection: "row", justifyContent: "space-between" },
  exerciseNum: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  removeBtn: { fontSize: font.sm, color: colors.danger },
  exPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  exPickerSelected: { fontSize: font.sm, color: colors.white, flex: 1 },
  exPickerPlaceholder: { fontSize: font.sm, color: colors.muted, flex: 1 },
  chevron: { color: colors.muted },
  exList: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 160,
  },
  exOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  exOptionText: { fontSize: font.sm, color: colors.white },
  exFields: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  exFieldHalf: { width: "47%" },
  fieldLabel: { fontSize: font.xs, color: colors.muted, marginBottom: 4 },
  smallInput: {
    height: 36,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
});
