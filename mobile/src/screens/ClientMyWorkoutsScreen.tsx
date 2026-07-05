import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { usePreviewClientId } from "../contexts/PreviewClient";
import { api } from "../lib/api";
import { colors, font, radius, spacing } from "../theme";
import type { PortalPlannedExercise, PortalUpcomingSession } from "../types";

function whenLabel(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const day =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { day, time };
}

function exercisePreview(planned: PortalPlannedExercise[]): string {
  if (planned.length === 0) return "";
  const names = planned.slice(0, 3).map((p) => p.exercise_name.split(" (")[0]);
  const more = planned.length > 3 ? `, +${planned.length - 3} more` : "";
  return `${names.join(", ")}${more} — ${planned.length} exercise${planned.length === 1 ? "" : "s"}`;
}

/** CLIENT-facing, fully read-only. No create/edit/cancel — change requests route
 *  to the trainer. Same warm tone as the client dashboard. */
export default function ClientMyWorkoutsScreen() {
  const [detail, setDetail] = useState<PortalUpcomingSession | null>(null);
  const clientId = usePreviewClientId();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["client-portal", "my-workouts", clientId],
    queryFn: () => api.clientPortal.myWorkouts(clientId),
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>Couldn't load your workouts</Text>
        <Text style={styles.errorMsg}>{(error as Error)?.message ?? "Please try again."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { next_session, upcoming_sessions, current_program } = data;
  const rest = upcoming_sessions.filter((s) => s.id !== next_session?.id);
  const requestChange = () =>
    Alert.alert(
      "Need a change?",
      "Scheduling is managed by your trainer. Reach out to them to reschedule or cancel a session.",
      [{ text: "Got it" }]
    );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.muted} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Workouts</Text>
          <TouchableOpacity style={styles.bell}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {!next_session ? (
          <EmptyState
            title="No sessions scheduled yet"
            subtitle="Check with your trainer — they'll set up your next session."
          />
        ) : (
          <>
            {/* Next Up */}
            {(() => {
              const { day, time } = whenLabel(next_session.scheduled_at);
              const preview = exercisePreview(next_session.planned_exercises);
              return (
                <TouchableOpacity
                  style={styles.nextCard}
                  activeOpacity={next_session.planned_exercises.length ? 0.85 : 1}
                  onPress={() => next_session.planned_exercises.length && setDetail(next_session)}
                >
                  <Text style={styles.nextLabel}>NEXT UP</Text>
                  <Text style={styles.nextWhen}>
                    {day} · {time}
                  </Text>
                  {next_session.trainer_name && (
                    <Text style={styles.nextTrainer}>with {next_session.trainer_name}</Text>
                  )}
                  {next_session.plan_label && <Text style={styles.planLabel}>📋 {next_session.plan_label}</Text>}
                  {preview ? (
                    <>
                      <Text style={styles.preview}>{preview}</Text>
                      <Text style={styles.expandHint}>Tap to see the full plan ›</Text>
                    </>
                  ) : (
                    <Text style={styles.previewMuted}>Your trainer hasn't posted a plan for this one yet.</Text>
                  )}
                  {next_session.notes && <Text style={styles.nextNotes}>“{next_session.notes}”</Text>}
                </TouchableOpacity>
              );
            })()}

            {/* Current program */}
            {current_program && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Current program</Text>
                <Text style={styles.programName}>{current_program.name}</Text>
                <View style={styles.programMetaRow}>
                  {current_program.current_week != null && (
                    <View style={styles.programChip}>
                      <Text style={styles.programChipText}>Week {current_program.current_week}</Text>
                    </View>
                  )}
                  {current_program.days_per_week > 0 && (
                    <View style={styles.programChip}>
                      <Text style={styles.programChipText}>{current_program.days_per_week}× / week</Text>
                    </View>
                  )}
                </View>
                {current_program.goal && <Text style={styles.programGoal}>{current_program.goal}</Text>}
              </View>
            )}

            {/* Upcoming sessions */}
            {rest.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming sessions</Text>
                {rest.map((s) => {
                  const { day, time } = whenLabel(s.scheduled_at);
                  return (
                    <TouchableOpacity key={s.id} style={styles.upRow} onPress={() => setDetail(s)} activeOpacity={0.75}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upDay}>{day}</Text>
                        <Text style={styles.upMeta}>
                          {time}
                          {s.trainer_name ? ` · ${s.trainer_name}` : ""}
                          {s.plan_label ? ` · ${s.plan_label}` : ""}
                        </Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{s.status}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Read-only reminder + request-change routing */}
            <TouchableOpacity style={styles.requestBtn} onPress={requestChange}>
              <Text style={styles.requestText}>Need to reschedule? Message your trainer</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Read-only session detail */}
      {detail && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBackdrop} activeOpacity={1} onPress={() => setDetail(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {(() => {
              const { day, time } = whenLabel(detail.scheduled_at);
              return (
                <>
                  <Text style={styles.sheetTitle}>{detail.plan_label ?? "Session"}</Text>
                  <Text style={styles.sheetWhen}>
                    {day} · {time}
                    {detail.trainer_name ? ` · with ${detail.trainer_name}` : ""}
                  </Text>
                  <ScrollView style={{ maxHeight: 380 }}>
                    {detail.planned_exercises.length === 0 ? (
                      <Text style={styles.previewMuted}>No plan posted for this session yet.</Text>
                    ) : (
                      detail.planned_exercises.map((p, i) => (
                        <View key={i} style={styles.plannedRow}>
                          <Text style={styles.plannedName}>{p.exercise_name}</Text>
                          <Text style={styles.plannedTarget}>
                            {p.target_sets ? `${p.target_sets} × ` : ""}
                            {p.target_reps ?? ""}
                            {p.target_weight ? `  @ ${p.target_weight} ${p.target_weight_unit ?? ""}` : ""}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                  {detail.notes && <Text style={styles.nextNotes}>“{detail.notes}”</Text>}
                  <Text style={styles.readOnlyNote}>
                    This is your trainer's plan — read-only. Reach out to them for any changes.
                  </Text>
                </>
              );
            })()}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: font.xxl, fontWeight: "800", color: colors.white },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  nextCard: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "50",
    borderRadius: radius.lg + 4,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  nextLabel: { color: colors.accent, fontSize: font.xs, fontWeight: "700", letterSpacing: 1.5 },
  nextWhen: { color: colors.white, fontSize: font.xl, fontWeight: "700" },
  nextTrainer: { color: colors.muted, fontSize: font.sm },
  planLabel: { color: colors.white, fontSize: font.sm, fontWeight: "600", marginTop: spacing.xs },
  preview: { color: colors.white, fontSize: font.sm },
  previewMuted: { color: colors.muted, fontSize: font.sm },
  expandHint: { color: colors.accent, fontSize: font.xs, fontWeight: "600" },
  nextNotes: { color: colors.muted, fontSize: font.sm, fontStyle: "italic", marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.xs,
  },
  cardTitle: { color: colors.muted, fontSize: font.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  programName: { color: colors.white, fontSize: font.lg, fontWeight: "700" },
  programMetaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  programChip: {
    backgroundColor: colors.accentDim,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  programChipText: { color: colors.accent, fontSize: font.xs, fontWeight: "600" },
  programGoal: { color: colors.muted, fontSize: font.sm, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: font.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  upRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  upDay: { color: colors.white, fontSize: font.base, fontWeight: "600" },
  upMeta: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  statusPill: {
    backgroundColor: "#3b82f6" + "22",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusPillText: { color: "#3b82f6", fontSize: font.xs, fontWeight: "600", textTransform: "capitalize" },
  requestBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  requestText: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetTitle: { color: colors.white, fontSize: font.lg, fontWeight: "700" },
  sheetWhen: { color: colors.muted, fontSize: font.sm },
  plannedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  plannedName: { color: colors.white, fontSize: font.sm, flex: 1 },
  plannedTarget: { color: colors.accent, fontSize: font.sm, fontWeight: "600" },
  readOnlyNote: { color: colors.muted, fontSize: font.xs, fontStyle: "italic", marginTop: spacing.xs },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  errorEmoji: { fontSize: 40 },
  errorTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, textAlign: "center" },
  errorMsg: { fontSize: font.sm, color: colors.muted, textAlign: "center" },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryText: { color: "#000", fontWeight: "700", fontSize: font.base },
});
