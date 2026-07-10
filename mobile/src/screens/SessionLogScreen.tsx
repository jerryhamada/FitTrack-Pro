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
import { api, NetworkError } from "../lib/api";
import { useSetWriteQueue } from "../lib/offlineSetQueue";
import { formatHeight, formatWeight, toLbs } from "../lib/utils";
import type { DistanceUnit, Exercise, MeasurementType, PeakSet, SetEntry, SetStatus, Unit } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { MUSCLE_REGIONS as MUSCLES } from "../lib/muscles";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SessionLog">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type InsightLite = { last3: string; sessions_used: number; last_used_at: string; peak: PeakSet | null };


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
  const { data: trainer } = useQuery({ queryKey: ["trainer-me"], queryFn: api.trainer.me });
  const { data: insights } = useQuery({
    queryKey: ["exercise-insights", session?.client_id],
    queryFn: () => api.clients.exerciseInsights(session!.client_id),
    enabled: !!session,
  });

  // ----- session-level state -----
  const [now, setNow] = useState(Date.now());
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null); // null = not touched yet
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

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
    const map = new Map<number, InsightLite>();
    for (const i of insights?.exercises ?? []) {
      map.set(i.exercise_id, {
        last3: i.last3_best
          .map((b) => `${b.weight != null ? Math.round(b.weight) : "BW"}×${b.reps ?? "—"}`)
          .join(", "),
        sessions_used: i.sessions_used,
        last_used_at: i.last_used_at,
        peak: i.peak_set,
      });
    }
    return map;
  }, [insights]);

  // Exercise membership + grouping come from the server (session_exercises).
  const membership = useMemo(
    () => [...(session?.session_exercises ?? [])].sort((a, b) => a.order_index - b.order_index),
    [session?.session_exercises]
  );

  // Render blocks: standalone exercises + superset groups (members kept adjacent).
  const blocks = useMemo(() => {
    const out: (
      | { type: "standalone"; exerciseId: number }
      | { type: "superset"; groupId: string; memberIds: number[] }
    )[] = [];
    const emitted = new Set<string>();
    for (const m of membership) {
      if (m.superset_group_id) {
        if (emitted.has(m.superset_group_id)) continue;
        emitted.add(m.superset_group_id);
        const memberIds = membership
          .filter((x) => x.superset_group_id === m.superset_group_id)
          .sort((a, b) => (a.superset_order ?? 0) - (b.superset_order ?? 0))
          .map((x) => x.exercise_id);
        out.push({ type: "superset", groupId: m.superset_group_id, memberIds });
      } else {
        out.push({ type: "standalone", exerciseId: m.exercise_id });
      }
    }
    return out;
  }, [membership]);

  const setsByExercise = useMemo(() => {
    const map = new Map<number, SetEntry[]>();
    for (const s of session?.sets ?? []) {
      const arr = map.get(s.exercise_id) ?? [];
      arr.push(s);
      map.set(s.exercise_id, arr);
    }
    // Backend order isn't guaranteed (order_index is always 0) — sort by
    // set_number so sets always display oldest-to-newest.
    for (const arr of map.values()) arr.sort((a, b) => a.set_number - b.set_number);
    return map;
  }, [session?.sets]);

  // ----- offline set queue (gym dead zones) -----
  // Set writes that failed with a NetworkError are queued and retried when
  // connectivity returns (see lib/offlineSetQueue.ts / lib/retryQueue.ts).
  const { pending, enqueue, remove: removeQueued, flush } = useSetWriteQueue(sessionId);

  // When queued writes drain in the background (reconnect), refetch the session
  // so optimistic pending rows are replaced by real server sets (with PR flags).
  const prevPendingCount = useRef(pending.length);
  useEffect(() => {
    if (pending.length < prevPendingCount.current) {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    }
    prevPendingCount.current = pending.length;
  }, [pending.length, qc, sessionId]);

  // Merge server sets with optimistic pending ones. Pending sets get negative
  // temp ids (mapped back to their queue entry for delete), and sets with a
  // queued delete are hidden immediately.
  const { displaySets, queueIdByTempId } = useMemo(() => {
    const pendingDeleteIds = new Set<number>();
    for (const p of pending) if (p.kind === "deleteSet") pendingDeleteIds.add(p.setId);
    const map = new Map<number, SetEntry[]>();
    for (const [exId, arr] of setsByExercise) {
      map.set(
        exId,
        arr.filter((s) => !pendingDeleteIds.has(s.id))
      );
    }
    const byTemp = new Map<number, string>();
    let temp = -1;
    for (const p of pending) {
      if (p.kind !== "logSet") continue;
      const exId = p.body.exercise_id;
      const arr = map.get(exId) ?? [];
      byTemp.set(temp, p.id);
      arr.push({
        id: temp,
        session_id: sessionId,
        exercise_id: exId,
        exercise_name: exerciseById.get(exId)?.name ?? "",
        order_index: 0,
        set_number: arr.length + 1,
        weight: (p.body.weight as number | undefined) ?? null,
        weight_unit: (p.body.weight_unit as SetEntry["weight_unit"]) ?? null,
        height: (p.body.height as number | undefined) ?? null,
        height_unit: (p.body.height_unit as SetEntry["height_unit"]) ?? null,
        band_color: (p.body.band_color as string | undefined) ?? null,
        is_per_side: false,
        reps: (p.body.reps as number | undefined) ?? null,
        // Local Epley estimate so the peak strip stays live even before sync.
        est_1rm:
          p.body.weight != null && p.body.reps != null
            ? (p.body.weight as number) * (1 + (p.body.reps as number) / 30)
            : null,
        effort_value: null,
        effort_type: null,
        set_modifier: null,
        status: "completed" as SetStatus,
        superset_group: null,
        notes: null,
        is_pr: false,
        pr_type: null,
        created_at: new Date(p.createdAt).toISOString(),
      });
      map.set(exId, arr);
      temp -= 1;
    }
    return { displaySets: map, queueIdByTempId: byTemp };
  }, [setsByExercise, pending, exerciseById, sessionId]);

  // Exercises eligible to group: standalone only (already-grouped ones can't re-group).
  const groupableIds = useMemo(
    () => membership.filter((m) => !m.superset_group_id).map((m) => m.exercise_id),
    [membership]
  );

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
      // Peak-set strip refreshes live: the server peak includes this session's sets.
      qc.invalidateQueries({ queryKey: ["exercise-insights", session?.client_id] });
      if (set.is_pr) celebratePr(set);
    },
    onError: (e, body) => {
      if (e instanceof NetworkError) {
        // Gym dead zone — keep the set. It shows immediately as a pending row
        // and syncs when connectivity returns (PR detection runs then).
        void enqueue({ kind: "logSet", sessionId, body: body as { exercise_id: number } & Record<string, unknown> });
        return;
      }
      Alert.alert("Error", (e as Error).message);
    },
  });

  const deleteSet = useMutation({
    mutationFn: (setId: number) => api.sessions.deleteSet(setId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["exercise-insights", session?.client_id] });
    },
    onError: (e, setId) => {
      if (e instanceof NetworkError) {
        void enqueue({ kind: "deleteSet", sessionId, setId });
        return;
      }
      Alert.alert("Error", (e as Error).message);
    },
  });

  // Deleting a pending (not-yet-synced) set just drops it from the queue.
  function handleDeleteSet(setId: number) {
    if (setId < 0) {
      const queueId = queueIdByTempId.get(setId);
      Alert.alert("Delete set?", "This set hasn't synced yet.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => queueId && void removeQueued(queueId) },
      ]);
      return;
    }
    Alert.alert("Delete set?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSet.mutate(setId) },
    ]);
  }

  const addExercise = useMutation({
    mutationFn: (exId: number) => api.sessions.addExercise(sessionId, exId),
    onSuccess: (updated, exId) => {
      qc.setQueryData(["session", sessionId], updated);
      setExpandedId(exId);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const createSuperset = useMutation({
    mutationFn: (ids: number[]) => api.sessions.createSuperset(sessionId, ids),
    onSuccess: (updated) => {
      qc.setQueryData(["session", sessionId], updated);
      setSelectMode(false);
      setSelected(new Set());
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const ungroup = useMutation({
    mutationFn: (groupId: string) => api.sessions.ungroupSuperset(sessionId, groupId),
    onSuccess: (updated) => qc.setQueryData(["session", sessionId], updated),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  function toggleSelected(exId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(exId)) next.delete(exId);
      else next.add(exId);
      return next;
    });
  }

  const complete = useMutation({
    mutationFn: () => api.sessions.complete(sessionId),
    onSuccess: (s) => {
      for (const key of ["clients", "dashboard", "client-sessions", "overview-stats", "weekly-stats", "pr-summary", "prs", "exercise-insights", "schedule", "sessions"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      navigation.replace("SessionSummary", { sessionId, summary: s });
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const cancelSession = useMutation({
    mutationFn: () => api.sessions.cancel(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-sessions"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["sessions", "active"] });
      navigation.replace("MainTabs");
      Alert.alert("Session canceled", "Session canceled successfully");
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  async function finishPressed() {
    if (!session) return;
    // Completing computes totals + PRs server-side, so every queued set must
    // land first — otherwise the summary silently misses offline sets.
    if (pending.length > 0) {
      const { remaining } = await flush();
      if (remaining > 0) {
        Alert.alert(
          "Still syncing",
          `${remaining} logged set${remaining === 1 ? " hasn't" : "s haven't"} reached the server yet. Reconnect and tap Finish again so totals and PRs come out right.`
        );
        return;
      }
      complete.mutate();
      return;
    }
    if (session.sets.length === 0) {
      Alert.alert("No sets logged", "End workout with no sets logged?", [
        { text: "Cancel", style: "cancel" },
        { text: "Finish", onPress: () => complete.mutate() },
      ]);
    } else {
      complete.mutate();
    }
  }

  // Finish button in the nav header — always accessible while logging.
  useEffect(() => {
    navigation.setOptions({
      headerLeft: undefined,
      gestureEnabled: true,
      headerRight: () => (
        <TouchableOpacity onPress={finishPressed} disabled={complete.isPending}>
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: font.base }}>
            {complete.isPending ? "..." : "Finish"}
          </Text>
        </TouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, session?.sets.length, complete.isPending, pending.length]);

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

      {/* Offline sync banner */}
      {pending.length > 0 && (
        <TouchableOpacity style={styles.offlineBar} onPress={() => void flush()} activeOpacity={0.8}>
          <Text style={styles.offlineBarText}>
            📡 {pending.length} set{pending.length === 1 ? "" : "s"} saved offline — will sync when
            you're back online. Tap to retry now.
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Today's plan (program day pre-fill) */}
        {session.planned_exercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's plan</Text>
            {session.planned_exercises.map((plan, i) => (
              <TouchableOpacity
                key={i}
                style={styles.plannedRow}
                onPress={() => addExercise.mutate(plan.exercise_id)}
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
        {membership.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintTitle}>No exercises yet</Text>
            <Text style={styles.emptyHintSub}>Add the first exercise to start logging sets.</Text>
          </View>
        )}

        {/* Group-as-superset toolbar */}
        {!selectMode && groupableIds.length >= 2 && (
          <TouchableOpacity style={styles.groupToggle} onPress={() => setSelectMode(true)}>
            <Text style={styles.groupToggleText}>⊟ Group as Superset</Text>
          </TouchableOpacity>
        )}
        {selectMode && (
          <View style={styles.selectBar}>
            <Text style={styles.selectBarText}>
              Select 2+ exercises to superset ({selected.size} chosen)
            </Text>
            <View style={styles.selectBarBtns}>
              <TouchableOpacity
                onPress={() => {
                  setSelectMode(false);
                  setSelected(new Set());
                }}
              >
                <Text style={styles.selectCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={selected.size < 2 || createSuperset.isPending}
                onPress={() => createSuperset.mutate([...selected])}
                style={[styles.groupBtn, (selected.size < 2 || createSuperset.isPending) && { opacity: 0.4 }]}
              >
                <Text style={styles.groupBtnText}>Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {blocks.map((block) =>
          block.type === "standalone" ? (
            <ExerciseCard
              key={`ex-${block.exerciseId}`}
              exercise={exerciseById.get(block.exerciseId)}
              exerciseId={block.exerciseId}
              sets={displaySets.get(block.exerciseId) ?? []}
              insight={insightByExercise.get(block.exerciseId)}
              expanded={expandedId === block.exerciseId}
              onToggle={() => setExpandedId(expandedId === block.exerciseId ? null : block.exerciseId)}
              defaultUnit={client?.preferred_unit ?? "lbs"}
              defaultDistanceUnit={trainer?.profile?.default_distance_unit ?? "in"}
              logSet={(body) => logSet.mutate(body)}
              logPending={logSet.isPending}
              deleteSet={handleDeleteSet}
              selectMode={selectMode}
              selected={selected.has(block.exerciseId)}
              onSelectToggle={() => toggleSelected(block.exerciseId)}
            />
          ) : (
            <SupersetCard
              key={`ss-${block.groupId}`}
              groupId={block.groupId}
              memberIds={block.memberIds}
              exerciseById={exerciseById}
              setsByExercise={displaySets}
              insightByExercise={insightByExercise}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              defaultUnit={client?.preferred_unit ?? "lbs"}
              defaultDistanceUnit={trainer?.profile?.default_distance_unit ?? "in"}
              logSet={(body) => logSet.mutate(body)}
              logPending={logSet.isPending}
              deleteSet={handleDeleteSet}
              onUngroup={() =>
                Alert.alert("Ungroup superset", "Exercises become standalone. Logged sets are kept.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Ungroup", onPress: () => ungroup.mutate(block.groupId) },
                ])
              }
            />
          )
        )}

        {/* Add exercise */}
        {!selectMode && <Btn label="+ Add Exercise" onPress={() => setAddOpen(true)} fullWidth />}

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
          addExercise.mutate(id);
          setAddOpen(false);
        }}
      />
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
  insight: { last3: string; sessions_used: number; peak: PeakSet | null } | undefined;
  expanded: boolean;
  onToggle: () => void;
  defaultUnit: Unit;
  defaultDistanceUnit: DistanceUnit;
  logSet: (body: Parameters<typeof api.sessions.logSet>[1]) => void;
  logPending: boolean;
  deleteSet: (setId: number) => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
  // Superset-member presentation:
  nested?: boolean; // rendered inside a superset card
  highlighted?: boolean; // "next up" in the alternating sequence
  hideSetCount?: boolean; // round counter shown at group level instead
}

function ExerciseCard({
  exerciseId,
  exercise,
  sets,
  insight,
  expanded,
  onToggle,
  defaultUnit,
  defaultDistanceUnit,
  logSet,
  logPending,
  deleteSet,
  selectMode,
  selected,
  onSelectToggle,
  nested,
  highlighted,
  hideSetCount,
}: ExerciseCardProps) {
  const measurement: MeasurementType =
    exercise?.measurement_type ?? (exercise?.tracks_height ? "height" : "weight");
  const tracksHeight = measurement === "height";
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bandColor, setBandColor] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(defaultDistanceUnit);
  const [bodyweight, setBodyweight] = useState(false);
  const [expandedNoteSetId, setExpandedNoteSetId] = useState<number | null>(null);

  // Mid-workout measurement change ("this one's actually banded") — persisted on
  // the exercise (per-trainer override for built-ins), so the fix sticks for
  // future workouts too. The exercises cache is patched in place so the inputs
  // flip immediately.
  const qc = useQueryClient();
  const changeMeasurement = useMutation({
    mutationFn: (m: MeasurementType) => api.exercises.setMeasurement(exerciseId, m),
    onSuccess: (updated) => {
      qc.setQueryData<Exercise[]>(["exercises"], (prev) =>
        prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev
      );
    },
  });

  function openMeasurementSettings() {
    const mark = (m: MeasurementType) => (measurement === m ? "✓ " : "");
    Alert.alert(
      exercise?.name ?? "Exercise settings",
      "How should sets be logged for this exercise?",
      [
        { text: `${mark("weight")}Weight (number)`, onPress: () => changeMeasurement.mutate("weight") },
        { text: `${mark("height")}Height (number)`, onPress: () => changeMeasurement.mutate("height") },
        { text: `${mark("band")}Band color (text)`, onPress: () => changeMeasurement.mutate("band") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  const hasPr = sets.some((s) => s.is_pr);

  // Current Peak Set for the info strip: the server-side peak (all history,
  // including this session once synced) raced against this session's local sets
  // so a peak-beating set updates the strip instantly — even mid-sync/offline.
  const livePeak = useMemo<PeakSet | null>(() => {
    let best = insight?.peak ?? null;
    let bestLbs = best ? toLbs(best.est_1rm, best.unit) : -Infinity;
    for (const s of sets) {
      if (s.est_1rm == null || s.weight == null || s.reps == null || s.status !== "completed") continue;
      const e1Lbs = toLbs(s.est_1rm, s.weight_unit ?? "lbs");
      if (e1Lbs > bestLbs) {
        bestLbs = e1Lbs;
        best = {
          weight: s.weight,
          unit: s.weight_unit ?? "lbs",
          reps: s.reps,
          is_per_side: s.is_per_side,
          est_1rm: Math.round(s.est_1rm * 10) / 10,
        };
      }
    }
    return best;
  }, [insight?.peak, sets]);

  function submit() {
    if (measurement === "band") {
      if (!bandColor.trim()) {
        Alert.alert("Enter a band color");
        return;
      }
      if (!reps) {
        Alert.alert("Enter reps");
        return;
      }
      logSet({
        exercise_id: exerciseId,
        band_color: bandColor.trim(),
        reps: Number(reps),
        status: "completed",
      });
      return;
    }
    if (tracksHeight) {
      if (!height) {
        Alert.alert("Enter a height");
        return;
      }
      if (!reps) {
        Alert.alert("Enter reps");
        return;
      }
      logSet({
        exercise_id: exerciseId,
        height: Number(height),
        height_unit: distanceUnit,
        reps: Number(reps),
        status: "completed",
      });
      return;
    }
    if (!bodyweight && !weight) {
      Alert.alert("Enter a weight (or mark bodyweight)");
      return;
    }
    if (!reps) {
      Alert.alert("Enter reps");
      return;
    }
    // Bodyweight sets may still carry extra load (e.g. weighted pull-ups) — an
    // empty or zero weight field just means bodyweight only.
    const hasWeight = weight.trim() !== "" && Number(weight) > 0;
    logSet({
      exercise_id: exerciseId,
      weight: bodyweight && !hasWeight ? undefined : Number(weight),
      weight_unit: bodyweight && !hasWeight ? undefined : unit,
      reps: Number(reps),
      status: "completed",
    });
  }

  const weightStep = unit === "lbs" ? 5 : 2.5;
  const heightStep = distanceUnit === "in" ? 1 : 2;

  return (
    <View
      style={[
        cardStyles.card,
        nested && cardStyles.cardNested,
        expanded && cardStyles.cardExpanded,
        highlighted && cardStyles.cardHighlighted,
        selected && cardStyles.cardSelected,
      ]}
    >
      <TouchableOpacity
        style={cardStyles.cardHeader}
        onPress={selectMode ? onSelectToggle : onToggle}
        activeOpacity={0.75}
      >
        {selectMode && (
          <View style={[cardStyles.checkbox, selected && cardStyles.checkboxOn]}>
            {selected && <Text style={cardStyles.checkboxTick}>✓</Text>}
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {exercise?.name ?? `Exercise #${exerciseId}`}
            </Text>
            {hasPr && <Text style={cardStyles.trophy}>🏆</Text>}
            {highlighted && <Text style={cardStyles.nextUp}>next up</Text>}
          </View>
          <View style={cardStyles.metaRow}>
            {exercise?.muscle_group && <Pill>{exercise.muscle_group}</Pill>}
            {!hideSetCount && (
              <Text style={cardStyles.setCount}>
                {sets.length} set{sets.length === 1 ? "" : "s"} today
              </Text>
            )}
          </View>
          {insight?.last3 && <Text style={cardStyles.last3}>Last 3: {insight.last3}</Text>}
        </View>
        {!selectMode && (
          <TouchableOpacity onPress={openMeasurementSettings} hitSlop={8} style={cardStyles.gearBtn}>
            <Text style={cardStyles.gearIcon}>⚙︎</Text>
          </TouchableOpacity>
        )}
        {!selectMode && <Text style={cardStyles.chevron}>{expanded ? "▾" : "▸"}</Text>}
      </TouchableOpacity>

      {expanded && !selectMode && (
        <View style={cardStyles.body}>
          {/* Peak Set info strip — highest est. 1RM on record for this client+exercise */}
          {measurement === "weight" && (
            <View style={cardStyles.peakStrip}>
              {livePeak ? (
                <>
                  <View style={cardStyles.peakCol}>
                    <Text style={cardStyles.peakLabel}>Current Peak Set</Text>
                    <Text style={cardStyles.peakValue}>
                      {formatWeight(livePeak.weight, livePeak.unit)} × {livePeak.reps}
                      {livePeak.is_per_side ? " ea." : ""}
                    </Text>
                  </View>
                  <View style={cardStyles.peakCol}>
                    <Text style={cardStyles.peakLabel}>Current Est. 1RM</Text>
                    <Text style={cardStyles.peakValue}>
                      {livePeak.est_1rm} {livePeak.unit}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={cardStyles.peakEmpty}>No peak set yet — this will be the first! 🚀</Text>
              )}
            </View>
          )}

          {/* Logged sets */}
          {sets.map((s) => (
            <View key={s.id}>
              <View style={cardStyles.setRow}>
                <Text style={cardStyles.setNum}>#{s.set_number}</Text>
                <Text style={cardStyles.setValue}>
                  {s.band_color != null
                    ? `${s.band_color} band`
                    : s.height != null
                      ? formatHeight(s.height, s.height_unit)
                      : s.weight != null
                        ? formatWeight(s.weight, s.weight_unit)
                        : "BW"}{" "}
                  × {s.reps ?? "—"}
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
              {measurement === "band" ? (
                <>
                  <Text style={cardStyles.fieldLabel}>Band color</Text>
                  <TextInput
                    style={cardStyles.bandInput}
                    value={bandColor}
                    onChangeText={setBandColor}
                    placeholder="red, green, black..."
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : tracksHeight ? (
                <>
                  <Text style={cardStyles.fieldLabel}>Height ({distanceUnit})</Text>
                  <View style={cardStyles.weightRow}>
                    <View style={[cardStyles.stepper, { flex: 1 }]}>
                      <TouchableOpacity
                        style={cardStyles.stepBtn}
                        onPress={() => setHeight((v) => String(Math.max(0, (Number(v) || 0) - heightStep)))}
                      >
                        <Text style={cardStyles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={cardStyles.stepInput}
                        value={height}
                        onChangeText={setHeight}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.muted}
                      />
                      <TouchableOpacity
                        style={cardStyles.stepBtn}
                        onPress={() => setHeight((v) => String((Number(v) || 0) + heightStep))}
                      >
                        <Text style={cardStyles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={cardStyles.bwToggle}
                      onPress={() => setDistanceUnit((u) => (u === "in" ? "cm" : "in"))}
                      activeOpacity={0.8}
                    >
                      <Text style={cardStyles.bwToggleText}>{distanceUnit}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={cardStyles.fieldLabel}>
                    {bodyweight ? `Added weight (${unit})` : `Weight (${unit})`}
                  </Text>
                  <View style={cardStyles.weightRow}>
                    <View style={[cardStyles.stepper, { flex: 1 }]}>
                      <TouchableOpacity
                        style={cardStyles.stepBtn}
                        onPress={() => setWeight((v) => String(Math.max(0, (Number(v) || 0) - weightStep)))}
                      >
                        <Text style={cardStyles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={cardStyles.stepInput}
                        value={weight}
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
                    <TouchableOpacity
                      style={[cardStyles.bwToggle, bodyweight && cardStyles.bwToggleActive]}
                      onPress={() => setBodyweight((b) => !b)}
                      activeOpacity={0.8}
                    >
                      <Text style={[cardStyles.bwToggleText, bodyweight && cardStyles.bwToggleTextActive]}>BW</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
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

          <Btn label={logPending ? "Logging..." : "Add Set"} onPress={submit} loading={logPending} fullWidth />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Superset card — groups member exercises with a bracket, round counter, and a
// soft "next up" suggestion. Out-of-order logging is allowed (not gated).
// ---------------------------------------------------------------------------

interface SupersetCardProps {
  groupId: string;
  memberIds: number[];
  exerciseById: Map<number, Exercise>;
  setsByExercise: Map<number, SetEntry[]>;
  insightByExercise: Map<number, InsightLite>;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  defaultUnit: Unit;
  defaultDistanceUnit: DistanceUnit;
  logSet: (body: Parameters<typeof api.sessions.logSet>[1]) => void;
  logPending: boolean;
  deleteSet: (setId: number) => void;
  onUngroup: () => void;
}

function SupersetCard({
  groupId,
  memberIds,
  exerciseById,
  setsByExercise,
  insightByExercise,
  expandedId,
  setExpandedId,
  defaultUnit,
  defaultDistanceUnit,
  logSet,
  logPending,
  deleteSet,
  onUngroup,
}: SupersetCardProps) {
  const counts = memberIds.map((id) => (setsByExercise.get(id)?.length ?? 0));
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const totalRounds = Math.max(maxCount, minCount + 1);
  const currentRound = minCount + 1;
  // Next expected: first member (in A/B/C order) that's behind the round — i.e. the
  // earliest with the fewest sets. Soft suggestion only.
  const nextIdx = counts.findIndex((c) => c === minCount);
  const nextExerciseId = memberIds[nextIdx];
  const hasAnySets = maxCount > 0;

  return (
    <View style={supersetStyles.wrap}>
      <View style={supersetStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={supersetStyles.label}>Superset {groupId}</Text>
          <Text style={supersetStyles.round}>
            {hasAnySets ? `Round ${currentRound} of ${totalRounds}` : "Round 1 — alternate A→B→…"}
          </Text>
        </View>
        <TouchableOpacity onPress={onUngroup} hitSlop={8}>
          <Text style={supersetStyles.ungroup}>Ungroup</Text>
        </TouchableOpacity>
      </View>
      <View style={supersetStyles.members}>
        {memberIds.map((id, i) => (
          <View key={id} style={supersetStyles.memberRow}>
            <Text style={supersetStyles.memberLetter}>{String.fromCharCode(65 + i)}</Text>
            <View style={{ flex: 1 }}>
              <ExerciseCard
                exercise={exerciseById.get(id)}
                exerciseId={id}
                sets={setsByExercise.get(id) ?? []}
                insight={insightByExercise.get(id)}
                expanded={expandedId === id}
                onToggle={() => setExpandedId(expandedId === id ? null : id)}
                defaultUnit={defaultUnit}
                defaultDistanceUnit={defaultDistanceUnit}
                logSet={logSet}
                logPending={logPending}
                deleteSet={deleteSet}
                nested
                hideSetCount
                highlighted={id === nextExerciseId && hasAnySets}
              />
            </View>
          </View>
        ))}
      </View>
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
  insightByExercise: Map<number, InsightLite>;
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

  // Settings on each pick row: fix how an exercise is measured BEFORE adding it,
  // so the right input (weight / height / band color) shows from the first set.
  const qc = useQueryClient();
  const changeMeasurement = useMutation({
    mutationFn: (vars: { id: number; m: MeasurementType }) =>
      api.exercises.setMeasurement(vars.id, vars.m),
    onSuccess: (updated) => {
      qc.setQueryData<Exercise[]>(["exercises"], (prev) =>
        prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev
      );
    },
  });

  function openMeasurementSettings(e: Exercise) {
    const current = e.measurement_type ?? (e.tracks_height ? "height" : "weight");
    const mark = (m: MeasurementType) => (current === m ? "✓ " : "");
    Alert.alert(e.name, "How should sets be logged for this exercise?", [
      { text: `${mark("weight")}Weight (number)`, onPress: () => changeMeasurement.mutate({ id: e.id, m: "weight" }) },
      { text: `${mark("height")}Height (number)`, onPress: () => changeMeasurement.mutate({ id: e.id, m: "height" }) },
      { text: `${mark("band")}Band color (text)`, onPress: () => changeMeasurement.mutate({ id: e.id, m: "band" }) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const Option = ({ e }: { e: Exercise }) => (
    <TouchableOpacity style={sheetStyles.option} onPress={() => onPick(e.id)}>
      <Text style={sheetStyles.optionText}>{e.name}</Text>
      {e.muscle_group && <Text style={sheetStyles.optionMuscle}>{e.muscle_group}</Text>}
      <TouchableOpacity onPress={() => openMeasurementSettings(e)} hitSlop={8}>
        <Text style={sheetStyles.optionGear}>⚙︎</Text>
      </TouchableOpacity>
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

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  groupToggle: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  groupToggleText: { color: colors.muted, fontSize: font.xs, fontWeight: "600" },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  selectBarText: { color: colors.white, fontSize: font.xs, flex: 1 },
  selectBarBtns: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  selectCancel: { color: colors.muted, fontSize: font.sm, fontWeight: "600" },
  groupBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  groupBtnText: { color: "#000", fontSize: font.sm, fontWeight: "700" },
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
  offlineBar: {
    backgroundColor: colors.accentDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  offlineBarText: { color: colors.white, fontSize: font.xs, fontWeight: "600" },
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
});

const supersetStyles = StyleSheet.create({
  wrap: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs },
  label: { color: colors.accent, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  round: { color: colors.muted, fontSize: font.xs, marginTop: 1 },
  ungroup: { color: colors.muted, fontSize: font.xs, fontWeight: "600" },
  members: { gap: spacing.sm },
  memberRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  memberLetter: {
    color: colors.accent,
    fontSize: font.sm,
    fontWeight: "800",
    width: 16,
    textAlign: "center",
    paddingTop: spacing.base,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardExpanded: { borderColor: colors.accent + "50" },
  cardNested: { backgroundColor: colors.bg },
  cardHighlighted: { borderColor: colors.accent, borderWidth: 2 },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxTick: { color: "#000", fontSize: font.sm, fontWeight: "800" },
  nextUp: {
    fontSize: font.xs,
    color: colors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  peakStrip: {
    flexDirection: "row",
    gap: spacing.base,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  peakCol: { flex: 1, gap: 2 },
  peakLabel: { fontSize: font.xs, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  peakValue: { fontSize: font.sm, color: colors.accent, fontWeight: "700" },
  peakEmpty: { fontSize: font.sm, color: colors.accent, fontWeight: "600" },
  chevron: { fontSize: font.lg, color: colors.muted },
  gearBtn: { paddingHorizontal: spacing.xs },
  gearIcon: { fontSize: font.lg, color: colors.muted },
  bandInput: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: font.base,
  },
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
  weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  bwToggle: {
    width: 44,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  bwToggleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  bwToggleText: { fontSize: font.sm, fontWeight: "700", color: colors.muted },
  bwToggleTextActive: { color: colors.bg },
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
  optionGear: { fontSize: font.base, color: colors.muted, paddingLeft: spacing.sm },
  empty: { fontSize: font.sm, color: colors.muted, padding: spacing.md },
});
