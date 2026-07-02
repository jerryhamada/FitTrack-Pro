import DateTimePicker from "@react-native-community/datetimepicker";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
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
import EmptyState from "../components/EmptyState";
import Input from "../components/Input";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";
import type { RepeatRule, ScheduledSession } from "../types";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<TabParamList>
>;

type ViewMode = "day" | "week" | "month";

const STATUS_COLORS = {
  upcoming: "#3b82f6",
  completed: colors.accent,
  cancelled: colors.muted,
} as const;

const DAY_MS = 86_400_000;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ScheduleScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [detail, setDetail] = useState<ScheduledSession | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Fetch a generous window (anchor month ± 1 week) and slice client-side by local day.
  const range = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7);
    return { start: dateKey(start), end: dateKey(end) };
  }, [anchor]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["schedule", range.start, range.end],
    queryFn: () => api.schedule.list(range.start, range.end),
  });
  const { data: needsReview } = useQuery({
    queryKey: ["schedule", "needs-review"],
    queryFn: api.schedule.needsReview,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["schedule"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledSession[]>();
    for (const s of sessions ?? []) {
      const key = dateKey(new Date(s.scheduled_at));
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions]);

  const todayKey = dateKey(new Date());
  const todays = byDay.get(todayKey) ?? [];
  const anchorKey = dateKey(anchor);

  const shift = (dir: 1 | -1) => {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + dir);
    else if (view === "week") next.setDate(next.getDate() + 7 * dir);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  };

  const rangeTitle =
    view === "day"
      ? anchor.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      : view === "week"
        ? `Week of ${mondayOf(anchor).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const Block = ({ s, compact }: { s: ScheduledSession; compact?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.block,
        compact && styles.blockCompact,
        { borderLeftColor: STATUS_COLORS[s.status] },
        s.status === "cancelled" && { opacity: 0.5 },
      ]}
      onPress={() => setDetail(s)}
      activeOpacity={0.75}
    >
      <Text style={styles.blockTime}>{timeLabel(s.scheduled_at)}</Text>
      <View style={styles.blockClientRow}>
        {!compact &&
          (s.client_photo_url ? (
            <Image source={{ uri: s.client_photo_url }} style={styles.blockAvatar} />
          ) : (
            <View style={styles.blockAvatarFallback}>
              <Text style={styles.blockAvatarText}>{s.client_name.slice(0, 1)}</Text>
            </View>
          ))}
        <Text
          style={[styles.blockName, s.status === "cancelled" && { textDecorationLine: "line-through" }]}
          numberOfLines={1}
        >
          {compact ? s.client_name.split(" ")[0] : s.client_name}
        </Text>
      </View>
      {!compact && s.notes && (
        <Text style={styles.blockNotes} numberOfLines={1}>
          {s.notes}
        </Text>
      )}
    </TouchableOpacity>
  );

  // --- views ---

  const renderDay = () => {
    const daySessions = (byDay.get(anchorKey) ?? []).slice().sort((a, b) =>
      a.scheduled_at.localeCompare(b.scheduled_at)
    );
    return (
      <View style={styles.dayList}>
        {daySessions.length === 0 ? (
          <EmptyState
            title={anchorKey === todayKey ? "No sessions today" : "No sessions this day"}
            subtitle="Tap Add Session to schedule one."
          />
        ) : (
          daySessions.map((s) => <Block key={s.id} s={s} />)
        )}
      </View>
    );
  };

  const renderWeek = () => {
    const monday = mondayOf(anchor);
    return (
      <View style={styles.weekRow}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date(monday.getTime() + i * DAY_MS);
          const key = dateKey(day);
          const items = (byDay.get(key) ?? []).slice().sort((a, b) =>
            a.scheduled_at.localeCompare(b.scheduled_at)
          );
          return (
            <View key={key} style={styles.weekCol}>
              <TouchableOpacity
                onPress={() => {
                  setAnchor(day);
                  setView("day");
                }}
                style={[styles.weekColHeader, key === todayKey && styles.weekColHeaderToday]}
              >
                <Text style={styles.weekColDay}>
                  {day.toLocaleDateString("en-US", { weekday: "narrow" })}
                </Text>
                <Text style={[styles.weekColDate, key === todayKey && { color: colors.accent }]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
              {items.map((s) => (
                <Block key={s.id} s={s} compact />
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  const renderMonth = () => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = mondayOf(first);
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      weeks.push(Array.from({ length: 7 }, (_, i) => new Date(gridStart.getTime() + (w * 7 + i) * DAY_MS)));
    }
    return (
      <View style={styles.monthGrid}>
        <View style={styles.monthHeaderRow}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <Text key={i} style={styles.monthHeaderCell}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.monthWeekRow}>
            {week.map((day) => {
              const key = dateKey(day);
              const items = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === anchor.getMonth();
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.monthCell, key === todayKey && styles.monthCellToday]}
                  onPress={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                >
                  <Text style={[styles.monthCellDate, !inMonth && { color: colors.border }]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.monthDots}>
                    {items.slice(0, 3).map((s) => (
                      <View key={s.id} style={[styles.dot, { backgroundColor: STATUS_COLORS[s.status] }]} />
                    ))}
                    {items.length > 3 && <Text style={styles.dotMore}>+{items.length - 3}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Btn label="+ Add Session" onPress={() => setAddOpen(true)} />
      </View>

      {/* view toggle + range nav */}
      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          {(["day", "week", "month"] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.viewBtn, view === v && styles.viewBtnActive]}
              onPress={() => setView(v)}
            >
              <Text style={[styles.viewBtnText, view === v && { color: "#000" }]}>
                {v[0].toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.rangeNav}>
          <TouchableOpacity onPress={() => shift(-1)} hitSlop={8}>
            <Text style={styles.rangeArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAnchor(new Date())}>
            <Text style={styles.rangeTitle}>{rangeTitle}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shift(1)} hitSlop={8}>
            <Text style={styles.rangeArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* needs review banner */}
      {(needsReview?.length ?? 0) > 0 && (
        <TouchableOpacity style={styles.reviewBanner} onPress={() => setReviewOpen(true)}>
          <Text style={styles.reviewBannerText}>
            ⚠ {needsReview!.length} past session{needsReview!.length === 1 ? "" : "s"} — was it completed?
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Today strip */}
        <View style={styles.todayStrip}>
          <Text style={styles.todayStripTitle}>Today</Text>
          {todays.length === 0 ? (
            <Text style={styles.todayStripEmpty}>No sessions today</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {todays
                .slice()
                .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
                .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.todayChip, { borderColor: STATUS_COLORS[s.status] }]}
                    onPress={() => setDetail(s)}
                  >
                    <Text style={styles.todayChipTime}>{timeLabel(s.scheduled_at)}</Text>
                    <Text style={styles.todayChipName} numberOfLines={1}>
                      {s.client_name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}
        </View>

        {isLoading ? (
          <Spinner />
        ) : view === "day" ? (
          renderDay()
        ) : view === "week" ? (
          renderWeek()
        ) : (
          renderMonth()
        )}
      </ScrollView>

      {/* Detail sheet */}
      <SessionDetailSheet
        session={detail}
        onClose={() => setDetail(null)}
        onChanged={invalidate}
        onOpenClient={(clientId) => {
          setDetail(null);
          navigation.navigate("ClientProfile", { clientId });
        }}
        onStartWorkout={(sessionId) => {
          setDetail(null);
          navigation.navigate("SessionLog", { sessionId });
        }}
      />

      {/* Add sheet */}
      <AddSessionSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        defaultDate={anchor}
        onCreated={() => {
          setAddOpen(false);
          invalidate();
        }}
      />

      {/* Needs-review sheet */}
      <BottomSheet visible={reviewOpen} onClose={() => setReviewOpen(false)}>
        <Text style={styles.sheetTitle}>Past sessions to resolve</Text>
        <ScrollView style={{ maxHeight: 400 }}>
          {(needsReview ?? []).map((s) => (
            <ReviewRow key={s.id} s={s} onResolved={invalidate} />
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function ReviewRow({ s, onResolved }: { s: ScheduledSession; onResolved: () => void }) {
  const resolve = useMutation({
    mutationFn: (status: "completed" | "cancelled") => api.schedule.update(s.id, { status }),
    onSuccess: onResolved,
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });
  return (
    <View style={styles.reviewRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.reviewRowName}>{s.client_name}</Text>
        <Text style={styles.reviewRowDate}>
          {new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
          {timeLabel(s.scheduled_at)}
        </Text>
      </View>
      <TouchableOpacity style={styles.reviewBtn} onPress={() => resolve.mutate("completed")}>
        <Text style={{ color: colors.accent, fontWeight: "600", fontSize: font.xs }}>Completed</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.reviewBtn} onPress={() => resolve.mutate("cancelled")}>
        <Text style={{ color: colors.danger, fontWeight: "600", fontSize: font.xs }}>Cancelled</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface DetailProps {
  session: ScheduledSession | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenClient: (clientId: number) => void;
  onStartWorkout: (workoutSessionId: number) => void;
}

function SessionDetailSheet({ session, onClose, onChanged, onOpenClient, onStartWorkout }: DetailProps) {
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (body: Parameters<typeof api.schedule.update>[1]) => api.schedule.update(session!.id, body),
    onSuccess: () => {
      onChanged();
      setRescheduling(false);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const cancel = useMutation({
    mutationFn: (scope: "one" | "future") => api.schedule.cancel(session!.id, scope),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (scope: "one" | "future") => api.schedule.delete(session!.id, scope),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const startWorkout = useMutation({
    mutationFn: () => api.schedule.startWorkout(session!.id),
    onSuccess: (workout) => {
      onChanged();
      onStartWorkout(workout.id);
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (!session) return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;

  const scopeChoice = (verb: string, run: (scope: "one" | "future") => void) => {
    if (session.series_id) {
      Alert.alert(`${verb} repeating session`, "Apply to:", [
        { text: "This session only", onPress: () => run("one") },
        { text: "This and all future", style: "destructive", onPress: () => run("future") },
        { text: "Back", style: "cancel" },
      ]);
    } else {
      Alert.alert(`${verb} session?`, "", [
        { text: "No", style: "cancel" },
        { text: verb, style: "destructive", onPress: () => run("one") },
      ]);
    }
  };

  const notesValue = notes ?? session.notes ?? "";

  return (
    <BottomSheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <TouchableOpacity style={styles.detailClient} onPress={() => onOpenClient(session.client_id)}>
            {session.client_photo_url ? (
              <Image source={{ uri: session.client_photo_url }} style={styles.blockAvatar} />
            ) : (
              <View style={styles.blockAvatarFallback}>
                <Text style={styles.blockAvatarText}>{session.client_name.slice(0, 1)}</Text>
              </View>
            )}
            <Text style={styles.detailClientName}>{session.client_name}</Text>
            <Text style={styles.detailClientLink}>View profile ›</Text>
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>When</Text>
            <Text style={styles.detailValue}>
              {new Date(session.scheduled_at).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              · {timeLabel(session.scheduled_at)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Repeat</Text>
            <Text style={styles.detailValue}>{session.repeat_rule ?? "none"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailValue, { color: STATUS_COLORS[session.status], fontWeight: "700" }]}>
              {session.status}
            </Text>
          </View>

          <TextInput
            style={styles.notesInput}
            value={notesValue}
            onChangeText={setNotes}
            onBlur={() => {
              if (notes !== null && notes !== (session.notes ?? "")) update.mutate({ notes });
            }}
            placeholder="Session notes (e.g. focus on lower body)"
            placeholderTextColor={colors.muted}
            multiline
          />

          {rescheduling ? (
            <View style={{ gap: spacing.sm }}>
              <DateTimePicker
                value={newDate}
                mode="datetime"
                display="spinner"
                themeVariant="dark"
                minuteInterval={5}
                onChange={(_, d) => d && setNewDate(d)}
              />
              <Btn
                label="Save new time"
                onPress={() => update.mutate({ scheduled_at: newDate.toISOString(), status: "upcoming" })}
                loading={update.isPending}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.actionsGrid}>
              {session.status !== "completed" && (
                <Btn
                  label={startWorkout.isPending ? "Starting..." : "Start Workout"}
                  onPress={() => startWorkout.mutate()}
                  loading={startWorkout.isPending}
                  fullWidth
                />
              )}
              <View style={styles.actionRow}>
                {session.status === "upcoming" && (
                  <Btn
                    label="Mark Completed"
                    variant="secondary"
                    onPress={() => update.mutate({ status: "completed" })}
                  />
                )}
                <Btn
                  label="Reschedule"
                  variant="secondary"
                  onPress={() => {
                    setNewDate(new Date(session.scheduled_at));
                    setRescheduling(true);
                  }}
                />
              </View>
              <View style={styles.actionRow}>
                {session.status === "upcoming" && (
                  <Btn
                    label="Cancel Session"
                    variant="danger"
                    onPress={() => scopeChoice("Cancel", (scope) => cancel.mutate(scope))}
                  />
                )}
                <Btn
                  label="Delete"
                  variant="danger"
                  onPress={() => scopeChoice("Delete", (scope) => remove.mutate(scope))}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------

interface AddProps {
  visible: boolean;
  onClose: () => void;
  defaultDate: Date;
  onCreated: () => void;
}

function AddSessionSheet({ visible, onClose, defaultDate, onCreated }: AddProps) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [when, setWhen] = useState<Date>(() => {
    const d = new Date(defaultDate);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [repeatUntil, setRepeatUntil] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api.clients.list("all"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.schedule.create({
        client_id: clientId!,
        scheduled_at: when.toISOString(),
        repeat,
        repeat_until: repeat && repeatUntil ? dateKey(repeatUntil) : null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      setClientId(null);
      setClientSearch("");
      setRepeat(null);
      setRepeatUntil(null);
      setNotes("");
      onCreated();
    },
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  const activeClients = (clients ?? []).filter((c) => c.status === "active");
  const q = clientSearch.trim().toLowerCase();
  const filteredClients = q ? activeClients.filter((c) => c.name.toLowerCase().includes(q)) : activeClients;
  const selected = activeClients.find((c) => c.id === clientId);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView style={{ maxHeight: 600 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sheetTitle}>Add Session</Text>

          {selected ? (
            <TouchableOpacity style={styles.selectedClient} onPress={() => setClientId(null)}>
              <Text style={styles.selectedClientName}>{selected.name}</Text>
              <Text style={styles.selectedClientChange}>change</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Input
                placeholder="Search clients..."
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCorrect={false}
              />
              <View style={styles.clientList}>
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                  {filteredClients.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.clientOption} onPress={() => setClientId(c.id)}>
                      <Text style={styles.clientOptionText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Date & time</Text>
          <DateTimePicker
            value={when}
            mode="datetime"
            display="spinner"
            themeVariant="dark"
            minuteInterval={5}
            onChange={(_, d) => d && setWhen(d)}
            style={{ height: 120 }}
          />

          <Text style={styles.fieldLabel}>Repeat</Text>
          <View style={styles.repeatRow}>
            {([
              { key: null, label: "None" },
              { key: "weekly" as const, label: "Weekly" },
              { key: "biweekly" as const, label: "Bi-weekly" },
            ]).map((r) => (
              <TouchableOpacity
                key={r.label}
                style={[styles.repeatChip, repeat === r.key && styles.repeatChipActive]}
                onPress={() => setRepeat(r.key)}
              >
                <Text style={[styles.repeatChipText, repeat === r.key && { color: "#000" }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {repeat && (
            <>
              <Text style={styles.fieldLabel}>Repeat until (defaults to 8 weeks)</Text>
              <DateTimePicker
                value={repeatUntil ?? new Date(when.getTime() + 28 * DAY_MS)}
                mode="date"
                display="compact"
                themeVariant="dark"
                onChange={(_, d) => d && setRepeatUntil(d)}
              />
            </>
          )}

          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.muted}
          />

          <Btn
            label={create.isPending ? "Saving..." : "Save Session"}
            onPress={() => create.mutate()}
            disabled={!clientId}
            loading={create.isPending}
            fullWidth
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  controls: { paddingHorizontal: spacing.base, gap: spacing.sm },
  viewToggle: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surface },
  viewBtnActive: { backgroundColor: colors.accent },
  viewBtnText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
  rangeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rangeArrow: { fontSize: 28, color: colors.accent, paddingHorizontal: spacing.md },
  rangeTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  reviewBanner: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger + "50",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  reviewBannerText: { color: colors.danger, fontSize: font.sm, fontWeight: "600", textAlign: "center" },
  scroll: { padding: spacing.base, gap: spacing.base, paddingBottom: 48 },
  todayStrip: { gap: spacing.xs },
  todayStripTitle: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  todayStripEmpty: { fontSize: font.sm, color: colors.muted },
  todayChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 160,
  },
  todayChipTime: { fontSize: font.xs, color: colors.muted },
  todayChipName: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  dayList: { gap: spacing.sm },
  block: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  blockCompact: { padding: spacing.xs, borderLeftWidth: 3 },
  blockTime: { fontSize: font.xs, color: colors.muted },
  blockClientRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  blockAvatar: { width: 24, height: 24, borderRadius: 12 },
  blockAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  blockAvatarText: { color: colors.accent, fontWeight: "700", fontSize: font.xs },
  blockName: { fontSize: font.sm, fontWeight: "600", color: colors.white, flexShrink: 1 },
  blockNotes: { fontSize: font.xs, color: colors.muted },
  weekRow: { flexDirection: "row", gap: 3 },
  weekCol: { flex: 1, gap: 3 },
  weekColHeader: { alignItems: "center", paddingVertical: spacing.xs, borderRadius: radius.sm },
  weekColHeaderToday: { backgroundColor: colors.accentDim },
  weekColDay: { fontSize: font.xs, color: colors.muted },
  weekColDate: { fontSize: font.sm, fontWeight: "700", color: colors.white },
  monthGrid: { gap: 3 },
  monthHeaderRow: { flexDirection: "row" },
  monthHeaderCell: { flex: 1, textAlign: "center", fontSize: font.xs, color: colors.muted },
  monthWeekRow: { flexDirection: "row", gap: 3 },
  monthCell: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 2,
  },
  monthCellToday: { borderColor: colors.accent },
  monthCellDate: { fontSize: font.xs, color: colors.white, fontWeight: "600" },
  monthDots: { flexDirection: "row", flexWrap: "wrap", gap: 2, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotMore: { fontSize: 9, color: colors.muted },
  sheetTitle: { fontSize: font.lg, fontWeight: "700", color: colors.white, marginBottom: spacing.xs },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewRowName: { fontSize: font.sm, fontWeight: "600", color: colors.white },
  reviewRowDate: { fontSize: font.xs, color: colors.muted },
  reviewBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  detailClient: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailClientName: { fontSize: font.lg, fontWeight: "700", color: colors.white, flex: 1 },
  detailClientLink: { fontSize: font.sm, color: colors.accent },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: font.sm, color: colors.muted },
  detailValue: { fontSize: font.sm, color: colors.white },
  notesInput: {
    minHeight: 44,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.white,
    fontSize: font.sm,
  },
  actionsGrid: { gap: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  selectedClient: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  selectedClientName: { fontSize: font.base, fontWeight: "600", color: colors.white },
  selectedClientChange: { fontSize: font.xs, color: colors.accent },
  clientList: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  clientOptionText: { fontSize: font.sm, color: colors.white },
  fieldLabel: {
    fontSize: font.xs,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  repeatRow: { flexDirection: "row", gap: spacing.sm },
  repeatChip: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  repeatChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  repeatChipText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
});
