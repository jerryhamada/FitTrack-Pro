import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet from "../components/BottomSheet";
import Btn from "../components/Btn";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatWeight } from "../lib/utils";
import type { EffortType, Exercise, SetEntry, SetStatus, Unit } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SessionLog">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
] as const;

function formatElapsed(startedAt: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

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
  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });
  const { data: insights } = useQuery({
    queryKey: ["exercise-insights", session?.client_id],
    queryFn: () => api.clients.exerciseInsights(session!.client_id),
    enabled: !!session,
  });

  // ----- session-level state -----
  const [now, setNow] = useState(Date.now());
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null); // null = not touched yet
  const [addedExercises, setAddedExercises] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.sessions.complete>> | null>(null);

  // Live timer — derived from the server-side start timestamp, so it survives
  // backgrounding, navigation, and app restarts.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const exerciseById = useMemo(() => {
    const map = new Map<number, Exercise>();
    for (const e of exercises ?? []) map.set(e.id, e);
    return map;
  }, [exercises]);

  const insightByExercise = useMemo(() => {
    const map = new Map<number, { last3: string; sessions_used: number; last_used_at: string }>();
    for (const i of insights?.exercises ?? []) {
      map.set(i.exercise_id, {
        last3: i.last3_best
          .map((b) => `${b.weight != null ? Math.round(b.weight) : "BW"}×${b.reps ?? "—"}`)
          .join(", "),
        sessions_used: i.sessions_used,
        last_used_at: i.last_used_at,
      });
    }
    return map;
  }, [insights]);

  // Exercises in today's session: derived from logged sets (first-seen order), plus
  // any just-added ones with no sets yet.
  const sessionExercises = useMemo(() => {
    const order: number[] = [];
    for (const s of session?.sets ?? []) {
      if (!order.includes(s.exercise_id)) order.push(s.exercise_id);
    }
    for (const id of addedExercises) {
      if (!order.includes(id)) order.push(id);
    }
    return order;
  }, [session?.sets, addedExercises]);

  const setsByExercise = useMemo(() => {
    const map = new Map<number, SetEntry[]>();
    for (const s of session?.sets ?? []) {
      const arr = map.get(s.exercise_id) ?? [];
      arr.push(s);
      map.set(s.exercise_id, arr);
    }
    return map;
  }, [session?.sets]);

  // ----- PR toast -----
  const [prMessage, setPrMessage] = useState<string | null>(null);
  const prAnim = useRef(new Animated.Value(0)).current;
  const prTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function celebratePr(set: SetEntry) {
    const what =
      set.pr_type === "estimated_1rm" ? "best estimated 1RM yet" : "heaviest set yet";
    setPrMessage(
      `New PR! ${set.weight != null ? formatWeight(set.weight, set.weight_unit) : "BW"} × ${set.reps ?? "—"} — ${what} on ${set.exercise_name}`
    );
    Animated.spring(prAnim, { toValue: 1, useNativeDriver: true, speed: 14 }).start();
    if (prTimer.current) clearTimeout(prTimer.current);
    prTimer.current = setTimeout(() => {
      Animated.timing(prAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setPrMessage(null)
      );
    }, 4000);
  }

  // ----- mutations -----
  const saveNotes = useMutation({
    mutationFn: (value: string) => api.sessions.update(sessionId, { notes: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", sessionId] }),
    meta: { skipGlobalToast: true },
  });

  const logSet = useMutation({
    mutationFn: (body: Parameters<typeof api.sessions.logSet>[1]) => api.sessions.logSet(sessionId, body),
    onSuccess: (set) => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      if (set.is_pr) celebratePr(set);
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
    onSuccess: (s) => setSummary(s), // slide-up summary sheet; navigation happens on Save
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const cancelSession = useMutation({
    mutationFn: () => api.sessions.cancel(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-sessions"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (client) {
        navigation.replace("ClientProfile", { clientId: client.id });
      } else {
        navigation.navigate("MainTabs");
      }
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  function finishPressed() {
    if (!session) return;
    if (session.sets.length === 0) {
      Alert.alert("No sets logged", "End workout with no sets logged?", [
        { text: "Cancel", style: "cancel" },
        { text: "Finish", onPress: () => complete.mutate() },
      ]);
    } else {
      complete.mutate();
    }
  }

  function saveWorkout() {
    const done = () => {
      for (const key of ["clients", "dashboard", "client-sessions", "overview-stats", "weekly-stats", "pr-summary", "prs", "exercise-insights", "schedule"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      setSummary(null);
      if (client) {
        navigation.replace("ClientProfile", { clientId: client.id });
      } else {
        navigation.navigate("MainTabs");
      }
    };
    if (notes !== null && notes !== (session?.notes ?? "")) {
      saveNotes.mutate(notes, { onSettled: done });
    } else {
      done();
    }
  }

  // Finish button in the nav header — always accessible.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={finishPressed} disabled={complete.isPending}>
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: font.base }}>
            {complete.isPending ? "..." : "Finish"}
          </Text>
        </TouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, session?.sets.length, complete.isPending]);

  if (isLoading || !session) return <Spinner />;

  const notesValue = notes ?? session.notes ?? "";

  return (
    <View style={styles.container}>
      {/* PR celebration toast */}
      {prMessage && (
        <Animated.View
          style={[
            styles.prToast,
            {
              opacity: prAnim,
              transform: [
                { translateY: prAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
              ],
            },
          ]}
        >
          <Text style={styles.prToastText}>🏆 {prMessage}</Text>
        </Animated.View>
      )}

      {/* Sticky workout header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {client?.photo_url ? (
            <Image source={{ uri: client.photo_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(client?.name ?? "?").slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName} numberOfLines={1}>
              {client?.name ?? session.label ?? "Session"}
            </Text>
            <Text style={styles.headerDate}>
              {new Date(session.started_at).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.timerBox}>
            <Text style={styles.timer}>{formatElapsed(session.started_at, now)}</Text>
            <Text style={styles.timerLabel}>elapsed</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notesToggle} onPress={() => setNotesOpen((o) => !o)}>
          <Text style={styles.notesToggleText}>
            {notesOpen ? "▾ Workout notes" : notesValue ? "▸ Workout notes ✓" : "▸ Add workout notes"}
          </Text>
        </TouchableOpacity>
        {notesOpen && (
          <TextInput
            style={styles.notesInput}
            value={notesValue}
            onChangeText={setNotes}
            onBlur={() => {
              if (notes !== null && notes !== (session.notes ?? "")) saveNotes.mutate(notes);
            }}
            placeholder="How did the session go?"
            placeholderTextColor={colors.muted}
            multiline
          />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Today's plan (program day pre-fill) */}
        {session.planned_exercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's plan</Text>
            {session.planned_exercises.map((plan, i) => (
              <TouchableOpacity
                key={i}
                style={styles.plannedRow}
                onPress={() => {
                  setAddedExercises((a) => (a.includes(plan.exercise_id) ? a : [...a, plan.exercise_id]));
                  setExpandedId(plan.exercise_id);
                }}
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

        {/* Exercise cards */}
        {sessionExercises.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintTitle}>No exercises yet</Text>
            <Text style={styles.emptyHintSub}>Add the first exercise to start logging sets.</Text>
          </View>
        )}
        {sessionExercises.map((exId) => (
          <ExerciseCard
            key={exId}
            exercise={exerciseById.get(exId)}
            exerciseId={exId}
            sets={setsByExercise.get(exId) ?? []}
            insight={insightByExercise.get(exId)}
            expanded={expandedId === exId}
            onToggle={() => setExpandedId(expandedId === exId ? null : exId)}
            defaultUnit={client?.preferred_unit ?? "lbs"}
            logSet={(body) => logSet.mutate(body)}
            logPending={logSet.isPending}
            deleteSet={(setId) =>
              Alert.alert("Delete set?", "", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteSet.mutate(setId) },
              ])
            }
          />
        ))}

        {/* Add exercise */}
        <Btn label="+ Add Exercise" onPress={() => setAddOpen(true)} fullWidth />

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
      </ScrollView>

      {/* Add Exercise sheet: body map + search */}
      <AddExerciseSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        exercises={exercises ?? []}
        insightByExercise={insightByExercise}
        onPick={(id) => {
          setAddedExercises((a) => (a.includes(id) ? a : [...a, id]));
          setExpandedId(id);
          setAddOpen(false);
        }}
      />

      {/* Finish summary sheet */}
      <BottomSheet visible={summary !== null} onClose={() => setSummary(null)}>
        {summary && (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.summaryTitle}>Workout complete 🎉</Text>
            <View style={styles.summaryGrid}>
              <SummaryStat
                label="Duration"
                value={
                  summary.duration_seconds != null
                    ? `${Math.round(summary.duration_seconds / 60)}m`
                    : formatElapsed(session.started_at, now)
                }
              />
              <SummaryStat
                label="Volume"
                value={`${Math.round(summary.total_volume).toLocaleString()} ${summary.total_volume_unit}`}
              />
              <SummaryStat label="Exercises" value={String(sessionExercises.length)} />
              <SummaryStat label="Sets" value={String(summary.total_sets)} />
            </View>
            {summary.prs_hit.length > 0 && (
              <View style={styles.summaryPrs}>
                <Text style={styles.summaryPrsTitle}>🏆 New PRs</Text>
                {summary.prs_hit.map((s) => (
                  <Text key={s.id} style={styles.summaryPrRow}>
                    {s.exercise_name}: {s.weight != null ? formatWeight(s.weight, s.weight_unit) : "BW"} ×{" "}
                    {s.reps ?? "—"}
                  </Text>
                ))}
              </View>
            )}
            <TextInput
              style={styles.notesInput}
              value={notesValue}
              onChangeText={setNotes}
              placeholder="Workout notes (last chance to edit)"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Btn label="Save Workout" onPress={saveWorkout} loading={saveNotes.isPending} fullWidth />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Exercise card with inline set logging
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  exerciseId: number;
  exercise: Exercise | undefined;
  sets: SetEntry[];
  insight: { last3: string; sessions_used: number } | undefined;
  expanded: boolean;
  onToggle: () => void;
  defaultUnit: Unit;
  logSet: (body: Parameters<typeof api.sessions.logSet>[1]) => void;
  logPending: boolean;
  deleteSet: (setId: number) => void;
}

function ExerciseCard({
  exerciseId,
  exercise,
  sets,
  insight,
  expanded,
  onToggle,
  defaultUnit,
  logSet,
  logPending,
  deleteSet,
}: ExerciseCardProps) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [effortValue, setEffortValue] = useState("");
  const [effortType, setEffortType] = useState<EffortType>("rpe");
  const [bodyweight, setBodyweight] = useState(false);
  const [setNotes, setSetNotes] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const [expandedNoteSetId, setExpandedNoteSetId] = useState<number | null>(null);

  const hasPr = sets.some((s) => s.is_pr);
  const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;

  function duplicateLast() {
    if (!lastSet) return;
    if (lastSet.weight != null) {
      setBodyweight(false);
      setWeight(String(lastSet.weight));
      setUnit(lastSet.weight_unit ?? defaultUnit);
    } else {
      setBodyweight(true);
    }
    setReps(lastSet.reps != null ? String(lastSet.reps) : "");
    if (lastSet.effort_value != null) {
      setEffortValue(String(lastSet.effort_value));
      setEffortType(lastSet.effort_type ?? "rpe");
    }
  }

  function submit() {
    if (!bodyweight && !weight) {
      Alert.alert("Enter a weight (or mark bodyweight)");
      return;
    }
    if (!reps) {
      Alert.alert("Enter reps");
      return;
    }
    logSet({
      exercise_id: exerciseId,
      weight: bodyweight ? undefined : Number(weight),
      weight_unit: bodyweight ? undefined : unit,
      reps: Number(reps),
      effort_value: effortValue ? Number(effortValue) : undefined,
      effort_type: effortValue ? effortType : undefined,
      notes: setNotes.trim() || undefined,
      status: "completed",
    });
    setSetNotes("");
    setShowNoteField(false);
  }

  const weightStep = unit === "lbs" ? 5 : 2.5;

  return (
    <View style={[cardStyles.card, expanded && cardStyles.cardExpanded]}>
      <TouchableOpacity style={cardStyles.cardHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {exercise?.name ?? `Exercise #${exerciseId}`}
            </Text>
            {hasPr && <Text style={cardStyles.trophy}>🏆</Text>}
          </View>
          <View style={cardStyles.metaRow}>
            {exercise?.muscle_group && <Pill>{exercise.muscle_group}</Pill>}
            <Text style={cardStyles.setCount}>
              {sets.length} set{sets.length === 1 ? "" : "s"} today
            </Text>
          </View>
          {insight?.last3 && <Text style={cardStyles.last3}>Last 3: {insight.last3}</Text>}
        </View>
        <Text style={cardStyles.chevron}>{expanded ? "▾" : "▸"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={cardStyles.body}>
          {/* Logged sets */}
          {sets.map((s) => (
            <View key={s.id}>
              <View style={cardStyles.setRow}>
                <Text style={cardStyles.setNum}>#{s.set_number}</Text>
                <Text style={cardStyles.setValue}>
                  {s.weight != null ? formatWeight(s.weight, s.weight_unit) : "BW"} × {s.reps ?? "—"}
                  {s.effort_value ? `  ${s.effort_type?.toUpperCase()} ${s.effort_value}` : ""}
                </Text>
                {s.is_pr && <Text style={cardStyles.trophy}>🏆</Text>}
                {s.notes ? (
                  <TouchableOpacity
                    onPress={() => setExpandedNoteSetId(expandedNoteSetId === s.id ? null : s.id)}
                    hitSlop={8}
                  >
                    <Text style={cardStyles.noteIcon}>📝</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => deleteSet(s.id)} hitSlop={8}>
                  <Text style={cardStyles.deleteX}>✕</Text>
                </TouchableOpacity>
              </View>
              {expandedNoteSetId === s.id && s.notes && (
                <Text style={cardStyles.setNoteBody}>{s.notes}</Text>
              )}
            </View>
          ))}

          {/* Input row */}
          <View style={cardStyles.inputRow}>
            <View style={{ flex: 3 }}>
              <Text style={cardStyles.fieldLabel}>Weight ({unit})</Text>
              <View style={cardStyles.stepper}>
                <TouchableOpacity
                  style={cardStyles.stepBtn}
                  onPress={() => setWeight((v) => String(Math.max(0, (Number(v) || 0) - weightStep)))}
                >
                  <Text style={cardStyles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={cardStyles.stepInput}
                  value={bodyweight ? "BW" : weight}
                  editable={!bodyweight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity
                  style={cardStyles.stepBtn}
                  onPress={() => setWeight((v) => String((Number(v) || 0) + weightStep))}
                >
                  <Text style={cardStyles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={cardStyles.fieldLabel}>Reps</Text>
              <View style={cardStyles.stepper}>
                <TouchableOpacity
                  style={cardStyles.stepBtn}
                  onPress={() => setReps((v) => String(Math.max(0, (Number(v) || 0) - 1)))}
                >
                  <Text style={cardStyles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={cardStyles.stepInput}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity
                  style={cardStyles.stepBtn}
                  onPress={() => setReps((v) => String((Number(v) || 0) + 1))}
                >
                  <Text style={cardStyles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={cardStyles.optionsRow}>
            <TouchableOpacity style={cardStyles.miniToggle} onPress={() => setBodyweight((b) => !b)}>
              <Text style={[cardStyles.miniToggleText, bodyweight && { color: colors.accent }]}>
                {bodyweight ? "✓ BW" : "BW"}
              </Text>
            </TouchableOpacity>
            <View style={cardStyles.effortWrap}>
              <TextInput
                style={cardStyles.effortInput}
                value={effortValue}
                onChangeText={setEffortValue}
                keyboardType="decimal-pad"
                placeholder="RPE"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity
                onPress={() => setEffortType(effortType === "rpe" ? "rir" : "rpe")}
                style={cardStyles.effortTypeBtn}
              >
                <Text style={cardStyles.effortTypeText}>{effortType.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={cardStyles.miniToggle} onPress={() => setShowNoteField((v) => !v)}>
              <Text style={[cardStyles.miniToggleText, showNoteField && { color: colors.accent }]}>📝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cardStyles.miniToggle, !lastSet && { opacity: 0.35 }]}
              onPress={duplicateLast}
              disabled={!lastSet}
            >
              <Text style={cardStyles.miniToggleText}>⧉ Last</Text>
            </TouchableOpacity>
          </View>

          {showNoteField && (
            <TextInput
              style={cardStyles.noteInput}
              value={setNotes}
              onChangeText={setSetNotes}
              placeholder="Set note (form cue, pain, tempo...)"
              placeholderTextColor={colors.muted}
            />
          )}

          <Btn label={logPending ? "Logging..." : "Add Set"} onPress={submit} loading={logPending} fullWidth />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add Exercise sheet — body map grid + search with smart sections
// ---------------------------------------------------------------------------

interface AddExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  insightByExercise: Map<number, { last3: string; sessions_used: number; last_used_at: string }>;
  onPick: (exerciseId: number) => void;
}

function AddExerciseSheet({ visible, onClose, exercises, insightByExercise, onPick }: AddExerciseSheetProps) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);

  // Reset transient state whenever the sheet reopens.
  useEffect(() => {
    if (visible) {
      setSearch("");
      setMuscle(null);
    }
  }, [visible]);

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = exercises;
    if (muscle) list = list.filter((e) => e.muscle_group === muscle);
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [exercises, muscle, q]);

  const recentlyUsed = useMemo(
    () =>
      exercises
        .filter((e) => insightByExercise.has(e.id))
        .sort(
          (a, b) =>
            new Date(insightByExercise.get(b.id)!.last_used_at).getTime() -
            new Date(insightByExercise.get(a.id)!.last_used_at).getTime()
        )
        .slice(0, 5),
    [exercises, insightByExercise]
  );

  const mostCommon = useMemo(
    () =>
      exercises
        .filter((e) => insightByExercise.has(e.id))
        .sort(
          (a, b) =>
            insightByExercise.get(b.id)!.sessions_used - insightByExercise.get(a.id)!.sessions_used
        )
        .slice(0, 5),
    [exercises, insightByExercise]
  );

  const favorites = useMemo(() => exercises.filter((e) => e.is_favorite), [exercises]);

  const showSections = !q && !muscle;

  const Option = ({ e }: { e: Exercise }) => (
    <TouchableOpacity style={sheetStyles.option} onPress={() => onPick(e.id)}>
      <Text style={sheetStyles.optionText}>{e.name}</Text>
      {e.muscle_group && <Text style={sheetStyles.optionMuscle}>{e.muscle_group}</Text>}
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>Add exercise</Text>
      <TextInput
        style={sheetStyles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercises..."
        placeholderTextColor={colors.muted}
        autoCorrect={false}
      />
      {/* Body map — muscle filter grid */}
      <View style={sheetStyles.muscleGrid}>
        {MUSCLES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[sheetStyles.muscleBtn, muscle === m && sheetStyles.muscleBtnActive]}
            onPress={() => setMuscle(muscle === m ? null : m)}
          >
            <Text style={[sheetStyles.muscleBtnText, muscle === m && { color: "#000" }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ maxHeight: 320 }}>
        {showSections ? (
          <>
            {recentlyUsed.length > 0 && (
              <>
                <Text style={sheetStyles.group}>Recently used</Text>
                {recentlyUsed.map((e) => (
                  <Option key={`r-${e.id}`} e={e} />
                ))}
              </>
            )}
            {favorites.length > 0 && (
              <>
                <Text style={sheetStyles.group}>★ Favorites</Text>
                {favorites.map((e) => (
                  <Option key={`f-${e.id}`} e={e} />
                ))}
              </>
            )}
            {mostCommon.length > 0 && (
              <>
                <Text style={sheetStyles.group}>Most common for this client</Text>
                {mostCommon.map((e) => (
                  <Option key={`c-${e.id}`} e={e} />
                ))}
              </>
            )}
            <Text style={sheetStyles.group}>All exercises</Text>
            {exercises.map((e) => (
              <Option key={e.id} e={e} />
            ))}
          </>
        ) : (
          <>
            {filtered.length === 0 && <Text style={sheetStyles.empty}>No exercises match.</Text>}
            {filtered.map((e) => (
              <Option key={e.id} e={e} />
            ))}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  prToast: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.base,
    right: spacing.base,
    zIndex: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  prToastText: { color: "#000", fontWeight: "700", fontSize: font.sm, textAlign: "center" },
  header: {
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.base },
  clientName: { fontSize: font.lg, fontWeight: "700", color: colors.white },
  headerDate: { fontSize: font.xs, color: colors.muted, marginTop: 1 },
  timerBox: { alignItems: "flex-end" },
  timer: { fontSize: font.xl, fontWeight: "700", color: colors.accent, fontVariant: ["tabular-nums"] },
  timerLabel: { fontSize: font.xs, color: colors.muted },
  notesToggle: {},
  notesToggleText: { fontSize: font.sm, color: colors.accent, fontWeight: "500" },
  notesInput: {
    minHeight: 60,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  content: { padding: spacing.base, gap: spacing.md, paddingBottom: 48 },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  emptyHint: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.xs },
  emptyHintTitle: { fontSize: font.md, fontWeight: "600", color: colors.white },
  emptyHintSub: { fontSize: font.sm, color: colors.muted },
  summaryTitle: { fontSize: font.xl, fontWeight: "700", color: colors.white, textAlign: "center" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryStat: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  summaryStatValue: { fontSize: font.lg, fontWeight: "700", color: colors.white },
  summaryStatLabel: { fontSize: font.xs, color: colors.muted },
  summaryPrs: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryPrsTitle: { fontSize: font.sm, fontWeight: "700", color: colors.accent },
  summaryPrRow: { fontSize: font.sm, color: colors.white },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardExpanded: { borderColor: colors.accent + "50" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.base,
    gap: spacing.sm,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontSize: font.md, fontWeight: "600", color: colors.white, flexShrink: 1 },
  trophy: { fontSize: font.md },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  setCount: { fontSize: font.xs, color: colors.muted },
  last3: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: font.lg, color: colors.muted },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  setNum: { fontSize: font.xs, color: colors.muted, width: 26 },
  setValue: { flex: 1, fontSize: font.base, fontWeight: "600", color: colors.white },
  noteIcon: { fontSize: font.sm },
  deleteX: { fontSize: font.sm, color: colors.muted, paddingLeft: spacing.xs },
  setNoteBody: {
    fontSize: font.xs,
    color: colors.muted,
    fontStyle: "italic",
    paddingHorizontal: spacing.sm,
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  fieldLabel: { fontSize: font.xs, color: colors.muted, marginBottom: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  stepBtnText: { fontSize: font.xl, color: colors.white, fontWeight: "300" },
  stepInput: {
    flex: 1,
    height: 48,
    textAlign: "center",
    color: colors.white,
    fontSize: font.lg,
    fontWeight: "600",
    backgroundColor: colors.surface,
  },
  optionsRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  miniToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  miniToggleText: { fontSize: font.sm, color: colors.muted, fontWeight: "600" },
  effortWrap: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: "hidden",
    height: 40,
  },
  effortInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
    backgroundColor: colors.bg,
  },
  effortTypeBtn: {
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  effortTypeText: { fontSize: font.xs, fontWeight: "700", color: colors.accent },
  noteInput: {
    height: 40,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
});

const sheetStyles = StyleSheet.create({
  title: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.sm },
  search: {
    height: 44,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: font.sm,
    marginBottom: spacing.sm,
  },
  muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  muscleBtn: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  muscleBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  muscleBtnText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  group: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    paddingVertical: spacing.sm,
    letterSpacing: 0.5,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: font.sm, color: colors.white, flex: 1 },
  optionMuscle: { fontSize: font.xs, color: colors.muted },
  empty: { fontSize: font.sm, color: colors.muted, padding: spacing.md },
});
