import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatWeight } from "../lib/utils";
import type { EffortType, PlannedExercise, SetStatus, Unit } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SessionLog">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SessionLogScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { sessionId } = route.params;
  const qc = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.sessions.get(sessionId),
  });
  const { data: client } = useQuery({
    queryKey: ["client", session?.client_id],
    queryFn: () => api.clients.get(session!.client_id),
    enabled: !!session,
  });
  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.exercises.list(),
  });

  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [weight, setWeight] = useState("45");
  const [reps, setReps] = useState("10");
  const [unit, setUnit] = useState<Unit>("lbs");
  const [isPerSide, setIsPerSide] = useState(false);
  const [bodyweightOnly, setBodyweightOnly] = useState(false);
  const [effortValue, setEffortValue] = useState("");
  const [effortType, setEffortType] = useState<EffortType>("rpe");
  const [status, setStatus] = useState<SetStatus>("completed");
  const [showExPicker, setShowExPicker] = useState(false);
  const [lastPr, setLastPr] = useState<string | null>(null);

  useEffect(() => {
    if (client) setUnit(client.preferred_unit);
  }, [client]);

  const favorites = useMemo(() => exercises?.filter((e) => e.is_favorite) ?? [], [exercises]);
  const selectedExercise = exercises?.find((e) => e.id === exerciseId);

  function selectPlanned(plan: PlannedExercise) {
    setExerciseId(plan.exercise_id);
    if (plan.target_weight != null) {
      setBodyweightOnly(false);
      setWeight(String(plan.target_weight));
      setUnit(plan.target_weight_unit ?? client?.preferred_unit ?? "lbs");
    } else {
      setBodyweightOnly(true);
    }
    const targetReps = plan.target_reps ? parseInt(plan.target_reps, 10) : NaN;
    if (!Number.isNaN(targetReps)) setReps(String(targetReps));
  }

  const logSet = useMutation({
    mutationFn: () =>
      api.sessions.logSet(sessionId, {
        exercise_id: exerciseId!,
        weight: bodyweightOnly ? undefined : Number(weight),
        weight_unit: bodyweightOnly ? undefined : unit,
        is_per_side: bodyweightOnly ? false : isPerSide,
        reps: Number(reps),
        effort_value: effortValue ? Number(effortValue) : undefined,
        effort_type: effortValue ? effortType : undefined,
        status,
      }),
    onSuccess: (set) => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      if (set.is_pr) {
        const msg = set.pr_type === "estimated_1rm" ? "New estimated 1RM PR!" : "New weight PR!";
        setLastPr(msg);
        setTimeout(() => setLastPr(null), 4000);
      }
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const deleteSet = useMutation({
    mutationFn: (setId: number) => api.sessions.deleteSet(setId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", sessionId] }),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const complete = useMutation({
    mutationFn: () => api.sessions.complete(sessionId),
    onSuccess: (summary) => {
      // Completed sessions change roster pulse, dashboard stats, and every
      // client-scoped insight (history, overview stats, PRs). Prefix-match all of them.
      for (const key of ["clients", "dashboard", "client-sessions", "overview-stats", "weekly-stats", "pr-summary", "prs"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      navigation.replace("SessionSummary", {
        sessionId,
        summary,
        clientId: session?.client_id,
      });
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const cancelSession = useMutation({
    mutationFn: () => api.sessions.cancel(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-sessions"] }); // drop the in-progress row from History
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (client) {
        navigation.replace("ClientProfile", { clientId: client.id });
      } else {
        navigation.navigate("MainTabs");
      }
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading || !session) return <Spinner />;

  const setsByExercise = session.sets.reduce<Record<string, typeof session.sets>>((acc, s) => {
    (acc[s.exercise_name] ??= []).push(s);
    return acc;
  }, {});

  const weightStep = unit === "lbs" ? 5 : 2.5;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {session.label ?? client?.name ?? "Session"}
      </Text>

      {lastPr && (
        <View style={styles.prBanner}>
          <Text style={styles.prBannerText}>🏆 {lastPr}</Text>
        </View>
      )}

      {/* Planned exercises */}
      {session.planned_exercises.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's plan</Text>
          {session.planned_exercises.map((plan, i) => (
            <TouchableOpacity
              key={i}
              style={styles.plannedRow}
              onPress={() => selectPlanned(plan)}
            >
              <Text style={styles.plannedName}>{plan.exercise_name}</Text>
              <Text style={styles.plannedTarget}>
                {plan.target_sets ? `${plan.target_sets} × ` : ""}
                {plan.target_reps ?? ""}{" "}
                {plan.target_weight ? formatWeight(plan.target_weight, plan.target_weight_unit) : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Log a set */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log a set</Text>

        {/* Exercise selector */}
        <TouchableOpacity style={styles.picker} onPress={() => setShowExPicker(!showExPicker)}>
          <Text style={selectedExercise ? styles.pickerSelected : styles.pickerPlaceholder}>
            {selectedExercise ? selectedExercise.name : "Select exercise..."}
          </Text>
          <Text style={styles.chevron}>{showExPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showExPicker && (
          <ScrollView style={styles.exList} nestedScrollEnabled>
            {favorites.length > 0 && (
              <>
                <Text style={styles.exListGroup}>★ Favorites</Text>
                {favorites.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.exOption}
                    onPress={() => { setExerciseId(e.id); setShowExPicker(false); }}
                  >
                    <Text style={styles.exOptionText}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <Text style={styles.exListGroup}>All exercises</Text>
            {exercises?.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.exOption}
                onPress={() => { setExerciseId(e.id); setShowExPicker(false); }}
              >
                <Text style={styles.exOptionText}>{e.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* BW toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setBodyweightOnly((b) => !b)}
        >
          <View style={[styles.checkbox, bodyweightOnly && styles.checkboxChecked]} />
          <Text style={styles.toggleLabel}>Bodyweight only</Text>
        </TouchableOpacity>

        {!bodyweightOnly && (
          <>
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setWeight((v) => String(Math.max(0, Number(v) - weightStep)))}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepInput}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setWeight((v) => String(Number(v) + weightStep))}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.unitToggle}>
                {(["lbs", "kg"] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitBtnText, unit === u && { color: "#000" }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.toggleRow} onPress={() => setIsPerSide((p) => !p)}>
              <View style={[styles.checkbox, isPerSide && styles.checkboxChecked]} />
              <Text style={styles.toggleLabel}>Per side</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Reps</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setReps((v) => String(Math.max(0, Number(v) - 1)))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.stepInput}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setReps((v) => String(Number(v) + 1))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Effort */}
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>RPE / RIR (optional)</Text>
            <TextInput
              style={styles.smallInput}
              value={effortValue}
              onChangeText={setEffortValue}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.unitToggle}>
              {(["rpe", "rir"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.unitBtn, effortType === t && styles.unitBtnActive]}
                  onPress={() => setEffortType(t)}
                >
                  <Text style={[styles.unitBtnText, effortType === t && { color: "#000" }]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Status */}
        <View>
          <Text style={styles.fieldLabel}>Set status</Text>
          <View style={styles.statusRow}>
            {(["completed", "partial", "skipped"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusBtn, status === s && styles.statusBtnActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Btn
          label={logSet.isPending ? "Logging..." : "Log Set"}
          onPress={() => {
            if (!exerciseId) { Alert.alert("Select an exercise first"); return; }
            logSet.mutate();
          }}
          loading={logSet.isPending}
          disabled={!exerciseId}
          fullWidth
        />
      </View>

      {/* Sets logged */}
      {Object.entries(setsByExercise).map(([exName, sets]) => (
        <View key={exName} style={styles.section}>
          <Text style={styles.sectionTitle}>{exName}</Text>
          {sets.map((s) => (
            <View key={s.id} style={styles.setRow}>
              <View style={styles.setInfo}>
                <Text style={styles.setWeight}>
                  {s.weight != null ? formatWeight(s.weight, s.weight_unit) : "BW"} × {s.reps ?? "—"}
                </Text>
                <Text style={styles.setMeta}>
                  #{s.set_number}
                  {s.effort_value ? ` · ${s.effort_type?.toUpperCase()} ${s.effort_value}` : ""}
                  {s.is_pr ? " · 🏆 PR" : ""}
                </Text>
              </View>
              <View style={styles.setBadges}>
                {s.status !== "completed" && (
                  <Pill tone={s.status === "skipped" ? "danger" : "default"}>{s.status}</Pill>
                )}
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Delete set?", "", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteSet.mutate(s.id) },
                    ])
                  }
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.finishRow}>
        <Btn
          label={complete.isPending ? "Finishing..." : "Finish Session"}
          onPress={() => {
            if (session.sets.length === 0) {
              Alert.alert(
                "No sets logged",
                "Finish without logging any sets?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Finish", onPress: () => complete.mutate() },
                ]
              );
            } else {
              complete.mutate();
            }
          }}
          loading={complete.isPending}
          fullWidth
        />
        <Btn
          label="Cancel session"
          variant="danger"
          onPress={() =>
            Alert.alert("Cancel session", "All logged sets will be deleted.", [
              { text: "Keep going", style: "cancel" },
              { text: "Cancel session", style: "destructive", onPress: () => cancelSession.mutate() },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 40 },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  prBanner: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + "50",
    padding: spacing.md,
    alignItems: "center",
  },
  prBannerText: { color: colors.accent, fontWeight: "700", fontSize: font.base },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: font.sm, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  plannedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  plannedName: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  plannedTarget: { fontSize: font.xs, color: colors.muted },
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
  chevron: { color: colors.muted },
  exList: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 180,
  },
  exListGroup: { fontSize: font.xs, fontWeight: "700", color: colors.muted, padding: spacing.sm, textTransform: "uppercase" },
  exOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  exOptionText: { fontSize: font.sm, color: colors.white },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleLabel: { fontSize: font.sm, color: colors.white },
  fieldRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  fieldLabel: { fontSize: font.xs, color: colors.muted, marginBottom: 4 },
  stepperRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  stepBtnText: { fontSize: font.lg, color: colors.white, fontWeight: "300" },
  stepInput: { flex: 1, height: 40, textAlign: "center", color: colors.white, fontSize: font.base, backgroundColor: colors.surface },
  smallInput: {
    height: 40,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  unitToggle: { flexDirection: "row", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  unitBtn: { flex: 1, padding: spacing.sm, alignItems: "center" },
  unitBtnActive: { backgroundColor: colors.accent },
  unitBtnText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statusBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent + "50" },
  statusBtnText: { fontSize: font.xs, fontWeight: "500", color: colors.muted, textTransform: "capitalize" },
  statusBtnTextActive: { color: colors.accent },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  setInfo: { gap: 2 },
  setWeight: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  setMeta: { fontSize: font.xs, color: colors.muted },
  setBadges: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  deleteBtn: { padding: spacing.xs },
  deleteBtnText: { fontSize: font.sm, color: colors.muted },
  finishRow: { gap: spacing.sm },
});
