import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Btn from "../../components/Btn";
import EmptyState from "../../components/EmptyState";
import MiniBarChart from "../../components/MiniBarChart";
import Spinner from "../../components/Spinner";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import type { Client, GoalType } from "../../types";
import { colors, font, radius, spacing } from "../../theme";

const GOAL_LABELS: Record<GoalType, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  fat_loss: "Fat Loss",
  endurance: "Endurance",
  general_fitness: "General Fitness",
};
const GOAL_TYPES = Object.keys(GOAL_LABELS) as GoalType[];

const CHART_TABS = ["Workouts", "Volume", "PRs", "Strength"] as const;
type ChartTab = (typeof CHART_TABS)[number];

interface OverviewTabProps {
  client: Client;
  onStartWorkout: () => void;
}

export default function OverviewTab({ client, onStartWorkout }: OverviewTabProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [chartTab, setChartTab] = useState<ChartTab>("Workouts");
  const [form, setForm] = useState({
    name: client.name,
    goals: client.goals ?? "",
    phone: client.phone ?? "",
    preferred_unit: client.preferred_unit,
    age: client.age != null ? String(client.age) : "",
    gender: client.gender ?? "",
    injuries_limitations: client.injuries_limitations ?? "",
    goal_type: client.goal_type,
    training_frequency_target: client.training_frequency_target,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["overview-stats", client.id],
    queryFn: () => api.clients.overviewStats(client.id),
  });
  const { data: weekly } = useQuery({
    queryKey: ["weekly-stats", client.id],
    queryFn: () => api.clients.weeklyStats(client.id, 12),
  });
  const { data: prs } = useQuery({
    queryKey: ["prs", client.id],
    queryFn: () => api.clients.prs(client.id),
  });

  const updateClient = useMutation({
    mutationFn: () =>
      api.clients.update(client.id, {
        name: form.name,
        goals: form.goals || null,
        phone: form.phone || null,
        preferred_unit: form.preferred_unit,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        injuries_limitations: form.injuries_limitations || null,
        goal_type: form.goal_type,
        training_frequency_target: form.training_frequency_target,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
    },
  });

  const weeklyBars = useMemo(
    () =>
      (weekly?.weeks ?? []).map((w) => ({
        label: formatDate(w.week_start),
        workouts: w.workouts,
        volume: w.volume,
      })),
    [weekly]
  );

  // PRs per month, trailing 6 months.
  const prBars = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        value: 0,
      });
    }
    for (const pr of prs ?? []) {
      const d = new Date(pr.achieved_at);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += 1;
    }
    return months;
  }, [prs]);

  const hasWorkouts = (stats?.lifetime_workouts ?? 0) > 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Client information */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Client information</Text>
          <TouchableOpacity onPress={() => setEditing((e) => !e)}>
            <Text style={styles.editBtn}>{editing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>
        {!editing ? (
          <View style={styles.rows}>
            <Row label="Age" value={client.age != null ? String(client.age) : "—"} />
            <Row label="Gender" value={client.gender || "—"} />
            <Row label="Phone" value={client.phone || "—"} />
            <Row label="Email" value={client.email} />
            <Row
              label="Goal"
              value={
                client.goal_type
                  ? GOAL_LABELS[client.goal_type] +
                    (client.training_frequency_target ? ` · ${client.training_frequency_target}x/wk` : "")
                  : "—"
              }
            />
            <Row label="Goals (notes)" value={client.goals || "—"} />
            {client.injuries_limitations ? (
              <View style={styles.injuryRow}>
                <Text style={styles.rowLabel}>Injuries</Text>
                <Text style={styles.injuryValue}>⚠ {client.injuries_limitations}</Text>
              </View>
            ) : (
              <Row label="Injuries" value="—" />
            )}
            <Row label="Member since" value={formatDate(client.created_at)} />
            <Row label="Unit" value={client.preferred_unit} />
          </View>
        ) : (
          <View style={styles.editFields}>
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <View style={styles.fieldPair}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Age"
                  value={form.age}
                  onChange={(v) => setForm({ ...form, age: v.replace(/[^0-9]/g, "") })}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 2 }}>
                <Field
                  label="Gender"
                  value={form.gender}
                  onChange={(v) => setForm({ ...form, gender: v })}
                  placeholder="Optional"
                />
              </View>
            </View>
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field
              label="Goals (notes)"
              value={form.goals}
              onChange={(v) => setForm({ ...form, goals: v })}
              multiline
            />
            <Field
              label="Injuries / limitations"
              value={form.injuries_limitations}
              onChange={(v) => setForm({ ...form, injuries_limitations: v })}
              placeholder="e.g. Right knee — avoid deep flexion"
              multiline
            />
            <Text style={styles.fieldLabel}>Goal</Text>
            <View style={styles.chipWrap}>
              {GOAL_TYPES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, form.goal_type === g && styles.chipActive]}
                  onPress={() => setForm({ ...form, goal_type: form.goal_type === g ? null : g })}
                >
                  <Text style={[styles.chipText, form.goal_type === g && { color: "#000" }]}>
                    {GOAL_LABELS[g]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Target sessions / week</Text>
            <View style={styles.chipWrap}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, form.training_frequency_target === n && styles.chipActive]}
                  onPress={() =>
                    setForm({
                      ...form,
                      training_frequency_target: form.training_frequency_target === n ? null : n,
                    })
                  }
                >
                  <Text
                    style={[styles.chipText, form.training_frequency_target === n && { color: "#000" }]}
                  >
                    {n}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.unitRow}>
              {(["lbs", "kg"] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, form.preferred_unit === u && styles.unitBtnActive]}
                  onPress={() => setForm({ ...form, preferred_unit: u })}
                >
                  <Text style={[styles.unitBtnText, form.preferred_unit === u && { color: "#000" }]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Btn label="Save changes" onPress={() => updateClient.mutate()} loading={updateClient.isPending} />
          </View>
        )}
      </View>

      {statsLoading && <Spinner />}

      {/* Empty state until the first workout */}
      {!statsLoading && !hasWorkouts && (
        <EmptyState
          title="Start their first workout"
          subtitle="Stats and progress charts appear once the first session is logged."
          action={<Btn label="Start Workout" onPress={onStartWorkout} />}
        />
      )}

      {/* Progress dashboard */}
      {!statsLoading && stats && hasWorkouts && (
        <>
          <View style={styles.statsGrid}>
            <Stat label="Workouts" value={String(stats.lifetime_workouts)} />
            <Stat label="PRs" value={String(stats.lifetime_prs)} />
            <Stat label="Hours" value={String(stats.hours_trained)} />
            <Stat label="Streak" value={stats.current_streak_weeks > 0 ? `${stats.current_streak_weeks}w 🔥` : "—"} />
            <Stat
              label="Avg / week"
              value={stats.avg_workouts_per_week != null ? String(stats.avg_workouts_per_week) : "—"}
            />
            <Stat label="Most improved" value={stats.most_improved_lift ?? "—"} small />
          </View>

          <View style={styles.card}>
            <View style={styles.chartTabs}>
              {CHART_TABS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chartTab, chartTab === t && styles.chartTabActive]}
                  onPress={() => setChartTab(t)}
                >
                  <Text style={[styles.chartTabText, chartTab === t && { color: "#000" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {chartTab === "Workouts" && (
              <MiniBarChart
                data={weeklyBars.map((w) => ({ label: `wk of ${w.label}`, value: w.workouts }))}
                unit="workouts"
              />
            )}
            {chartTab === "Volume" && (
              <MiniBarChart
                data={weeklyBars.map((w) => ({ label: `wk of ${w.label}`, value: w.volume }))}
                unit={weekly?.unit ?? "lbs"}
              />
            )}
            {chartTab === "PRs" && (
              <MiniBarChart
                data={prBars.map((m) => ({ label: m.label, value: m.value }))}
                unit="PRs"
              />
            )}
            {chartTab === "Strength" && <StrengthChart clientId={client.id} />}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Strength progression per lift — exercise picker + recent points (from Phase 1 Progress tab). */
function StrengthChart({ clientId }: { clientId: number }) {
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [metric, setMetric] = useState<"1rm" | "weight">("1rm");
  const [showPicker, setShowPicker] = useState(false);

  const { data: exercises } = useQuery({ queryKey: ["exercises"], queryFn: () => api.exercises.list() });
  const { data: progress, isLoading } = useQuery({
    queryKey: ["progress", clientId, exerciseId, metric],
    queryFn: () => api.clients.progress(clientId, exerciseId!, metric),
    enabled: exerciseId !== null,
  });

  const selected = exercises?.find((e) => e.id === exerciseId);
  const points = progress?.points ?? [];

  return (
    <View style={{ gap: spacing.sm }}>
      <TouchableOpacity style={styles.picker} onPress={() => setShowPicker(!showPicker)}>
        <Text style={selected ? styles.pickerSelected : styles.pickerPlaceholder}>
          {selected ? selected.name : "Select an exercise..."}
        </Text>
        <Text style={styles.pickerChevron}>{showPicker ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {showPicker && (
        <View style={styles.exerciseList}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {exercises?.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.exerciseOption, e.id === exerciseId && { backgroundColor: colors.accentDim }]}
                onPress={() => {
                  setExerciseId(e.id);
                  setShowPicker(false);
                }}
              >
                <Text style={[styles.exerciseOptionText, e.id === exerciseId && { color: colors.accent }]}>
                  {e.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.metricRow}>
        {(["1rm", "weight"] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.metricBtn, metric === m && { backgroundColor: colors.accent }]}
            onPress={() => setMetric(m)}
          >
            <Text style={[styles.metricBtnText, metric === m && { color: "#000" }]}>
              {m === "1rm" ? "Est. 1RM" : "Top Weight"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {isLoading && <Spinner />}
      {exerciseId === null && <Text style={styles.muted}>Pick a lift to see its progression.</Text>}
      {progress && points.length === 0 && <Text style={styles.muted}>No data yet for this exercise.</Text>}
      {progress && points.length > 0 && (
        <MiniBarChart
          data={points.slice(-12).map((p) => ({ label: formatDate(p.date), value: p.value }))}
          unit={progress.unit}
        />
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, small && styles.statValueSmall]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "number-pad" | "default";
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 72, paddingTop: spacing.sm }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  editBtn: { fontSize: font.sm, color: colors.accent, fontWeight: "500" },
  rows: { gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.base },
  rowLabel: { fontSize: font.sm, color: colors.muted },
  rowValue: { fontSize: font.sm, color: colors.white, textAlign: "right", flex: 1 },
  injuryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.base },
  injuryValue: { fontSize: font.sm, color: colors.danger, textAlign: "right", flex: 1, fontWeight: "600" },
  editFields: { gap: spacing.sm },
  fieldPair: { flexDirection: "row", gap: spacing.sm },
  fieldLabel: { fontSize: font.xs, fontWeight: "500", color: colors.muted },
  input: {
    height: 44,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: font.sm,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
  unitRow: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitBtn: { flex: 1, padding: spacing.sm, alignItems: "center" },
  unitBtnActive: { backgroundColor: colors.accent },
  unitBtnText: { fontWeight: "600", fontSize: font.sm, color: colors.muted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: font.lg, fontWeight: "700", color: colors.white, textAlign: "center" },
  statValueSmall: { fontSize: font.xs, fontWeight: "600" },
  statLabel: { fontSize: font.xs, color: colors.muted },
  chartTabs: { flexDirection: "row", gap: spacing.xs },
  chartTab: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chartTabText: { fontSize: font.xs, fontWeight: "600", color: colors.muted },
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
  pickerChevron: { color: colors.muted, fontSize: font.sm },
  exerciseList: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
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
  metricBtnText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
  muted: { fontSize: font.sm, color: colors.muted },
});
