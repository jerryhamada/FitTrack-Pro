import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MiniBarChart from "../components/MiniBarChart";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { formatDate, formatDuration } from "../lib/utils";
import { colors, font, radius, spacing } from "../theme";

const GOLD = "#eab308";
const FLAME = "#f97316";

function countdownLabel(iso: string, now: number): string | null {
  const target = new Date(iso);
  const nowDate = new Date(now);
  if (target.toDateString() !== nowDate.toDateString()) return null; // countdown only when today
  const mins = Math.floor((target.getTime() - now) / 60_000);
  if (mins <= 0) return "starting now";
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function sessionDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * CLIENT-FACING home screen — read-only and motivational (Strava/Whoop energy),
 * intentionally warmer than the trainer's admin dashboard. All data is scoped
 * server-side to the logged-in client.
 */
export default function ClientDashboardScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const [progressY, setProgressY] = useState(0);
  const [now, setNow] = useState(Date.now());

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["client-portal", "dashboard"],
    queryFn: () => api.clientPortal.dashboard(),
  });

  // Tick every 30s so the "in Xh Ym" countdown stays honest.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) return <Spinner />;

  // Surface errors instead of spinning forever (e.g. backend unreachable).
  if (isError || !data) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>Couldn't load your dashboard</Text>
        <Text style={styles.errorMsg}>{(error as Error)?.message ?? "Please try again."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isNewClient = data.lifetime_workouts === 0;
  const countdown = data.next_session ? countdownLabel(data.next_session.scheduled_at, now) : null;
  const firstName = data.client_name.split(" ")[0];

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.muted} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {data.client_photo_url ? (
            <Image source={{ uri: data.client_photo_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{data.client_name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.hello}>Let's go,</Text>
            <Text style={styles.name}>{firstName} 💪</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bell}>
          <Text style={{ fontSize: 16 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Next session */}
      <View style={styles.nextCard}>
        <Text style={styles.nextLabel}>NEXT SESSION</Text>
        {data.next_session ? (
          <>
            <Text style={styles.nextWhen}>
              {sessionDayLabel(data.next_session.scheduled_at)} ·{" "}
              {new Date(data.next_session.scheduled_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
            {countdown && <Text style={styles.countdown}>⏳ {countdown}</Text>}
            {data.next_session.trainer_name && (
              <Text style={styles.nextTrainer}>
                with {data.next_session.trainer_name}
                {data.trainer_business ? ` · ${data.trainer_business}` : ""}
              </Text>
            )}
            {data.next_session.notes && <Text style={styles.nextNotes}>“{data.next_session.notes}”</Text>}
            {isNewClient && (
              <Text style={styles.firstSession}>Your first session is coming up — you've got this! 🎉</Text>
            )}
          </>
        ) : (
          <Text style={styles.nextWhen}>
            {isNewClient ? "Your first session is coming up." : "Nothing scheduled yet."}
          </Text>
        )}
      </View>

      {/* New clients: stop here — no empty graphs. */}
      {!isNewClient && (
        <>
          {/* Progress snapshot */}
          <View style={styles.heroRow}>
            <View style={[styles.heroCard, { borderColor: FLAME + "50" }]}>
              <Text style={styles.heroEmoji}>🔥</Text>
              <Text style={[styles.heroValue, { color: FLAME }]}>{data.streak_weeks}</Text>
              <Text style={styles.heroLabel}>week streak</Text>
            </View>
            <View style={styles.heroCard}>
              <Text style={styles.heroValue}>{data.workouts_this_month}</Text>
              <Text style={styles.heroLabel}>this month</Text>
            </View>
            <View style={styles.heroCard}>
              <Text style={styles.heroValue}>{data.lifetime_workouts}</Text>
              <Text style={styles.heroLabel}>all time</Text>
            </View>
          </View>

          {/* Recent PRs — celebratory */}
          {data.recent_prs.length > 0 && (
            <View style={[styles.card, styles.prCard]}>
              <Text style={styles.prTitle}>🏆 Recent personal records</Text>
              {data.recent_prs.slice(0, 3).map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <Text style={styles.prName} numberOfLines={1}>
                    {pr.exercise_name}
                  </Text>
                  <Text style={styles.prValue}>
                    {pr.value} {pr.unit}
                    {pr.reps ? ` × ${pr.reps}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Progress graphs */}
          <View style={styles.card} onLayout={(e) => setProgressY(e.nativeEvent.layout.y)}>
            <Text style={styles.cardTitle}>Workouts per week</Text>
            <MiniBarChart
              data={data.weekly_workouts.map((w) => ({
                label: `wk of ${formatDate(w.week_start)}`,
                value: w.workouts,
              }))}
              unit="workouts"
            />
          </View>

          {data.key_lifts.map((lift) => (
            <View key={lift.exercise_name} style={styles.card}>
              <Text style={styles.cardTitle}>{lift.exercise_name} — estimated 1RM</Text>
              {lift.points.length > 1 ? (
                <MiniBarChart
                  data={lift.points.map((p) => ({ label: formatDate(p.date), value: p.value }))}
                  unit={lift.unit}
                />
              ) : (
                <Text style={styles.mutedText}>
                  Baseline set: {lift.points[0]?.value} {lift.unit}. Keep training to see the trend! 📈
                </Text>
              )}
            </View>
          ))}

          {/* Bodyweight trend: needs client-logged bodyweight (Phase 2, client-controlled) */}

          {/* Recent activity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent activity</Text>
            {data.recent_workouts.map((w) => (
              <View key={w.id} style={styles.activityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityDate}>{formatDate(w.started_at)}</Text>
                  <Text style={styles.activityMeta}>
                    {formatDuration(w.duration_seconds)} · {w.exercise_count} exercise
                    {w.exercise_count === 1 ? "" : "s"}
                  </Text>
                </View>
                {w.pr_count > 0 && (
                  <Text style={styles.activityPr}>
                    🏆 {w.pr_count} PR{w.pr_count === 1 ? "" : "s"}
                  </Text>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={() => navigation.navigate("History" as never)}>
              <Text style={styles.link}>View full history ›</Text>
            </TouchableOpacity>
          </View>

          {/* Quick actions — scroll to the matching section (no dead ends) */}
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate("My Workouts" as never)}
            >
              <Text style={styles.quickText}>My Workouts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => scrollRef.current?.scrollTo({ y: progressY, animated: true })}
            >
              <Text style={styles.quickText}>My Progress</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: font.lg },
  hello: { color: colors.muted, fontSize: font.sm },
  name: { color: colors.white, fontSize: font.xl, fontWeight: "700" },
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
  countdown: { color: colors.accent, fontSize: font.base, fontWeight: "600" },
  nextTrainer: { color: colors.muted, fontSize: font.sm },
  nextNotes: { color: colors.muted, fontSize: font.sm, fontStyle: "italic" },
  firstSession: { color: colors.white, fontSize: font.sm, marginTop: spacing.xs },
  heroRow: { flexDirection: "row", gap: spacing.sm },
  heroCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: 2,
  },
  heroEmoji: { fontSize: 20 },
  heroValue: { color: colors.white, fontSize: font.xxl, fontWeight: "800" },
  heroLabel: { color: colors.muted, fontSize: font.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  prCard: { borderColor: GOLD + "60", backgroundColor: GOLD + "14" },
  prTitle: { color: GOLD, fontSize: font.base, fontWeight: "700" },
  prRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  prName: { color: colors.white, fontSize: font.sm, flex: 1 },
  prValue: { color: GOLD, fontSize: font.sm, fontWeight: "700" },
  cardTitle: { color: colors.white, fontSize: font.base, fontWeight: "600" },
  mutedText: { color: colors.muted, fontSize: font.sm },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityDate: { color: colors.white, fontSize: font.sm, fontWeight: "600" },
  activityMeta: { color: colors.muted, fontSize: font.xs, marginTop: 2 },
  activityPr: { color: GOLD, fontSize: font.sm, fontWeight: "600" },
  link: { color: colors.accent, fontSize: font.sm, fontWeight: "600", paddingTop: spacing.xs },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  quickText: { color: colors.accent, fontWeight: "700", fontSize: font.sm },
});
