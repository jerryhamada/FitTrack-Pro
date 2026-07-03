import type {
  ActivityEvent,
  ClientHistory,
  ClientProgress,
  ClientMyWorkouts,
  ClientWorkoutDetail,
  ClientPortalDashboard,
  Notification,
  ProgressRange,
  RepeatRule,
  StrengthSeries,
  BodyweightLog,
  ScheduledSession,
  CalendarResponse,
  Client,
  ClientBadge,
  ClientCreateResponse,
  ClientExerciseInsights,
  ClientNote,
  ClientOverviewStats,
  ClientPRSummary,
  ClientProgram,
  ClientPulse,
  ClientWeeklyStats,
  DashboardStats,
  NoteCategory,
  Exercise,
  Invite,
  PR,
  Program,
  ProgramCreateInput,
  ProgramSummary,
  ProgressResponse,
  RecentPR,
  SessionListItem,
  SessionSummary,
  SetEntry,
  Trainer,
  TrainerProfile,
  VolumeByCategoryResponse,
  WorkoutSession,
} from "../types";

import Constants from "expo-constants";

const BACKEND_PORT = 8010;
// Manual override for when auto-detection can't help — e.g. a physical device on
// cellular, where you'd point this at a tunnelled backend URL.
const API_URL_OVERRIDE = process.env.EXPO_PUBLIC_API_URL ?? null;

/**
 * Derive the backend host from the address Metro is served on, so the app tracks
 * the Mac's LAN IP automatically instead of a hardcoded value that breaks every
 * time the network changes. Works on the simulator and any device on the same
 * Wi-Fi. Falls back to localhost (fine for the simulator) if it can't be read.
 */
function resolveBaseUrl(): string {
  if (API_URL_OVERRIDE) return API_URL_OVERRIDE;
  // e.g. "172.16.227.154:8081" (LAN) or "u-xxx.exp.direct:80" (tunnel)
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    "";
  const host = hostUri.split(":")[0];
  // Tunnel hosts don't forward the backend port — no LAN address to derive, so
  // fall back to localhost and rely on EXPO_PUBLIC_API_URL for real device+tunnel.
  if (host && !host.includes("exp.direct") && !host.includes("exp.host")) {
    return `http://${host}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function req<T = void>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const message =
      res.status === 401
        ? "Your session expired — sign in again to continue."
        : (err as { detail?: string }).detail ?? res.statusText;
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
  };
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  dashboard: {
    stats: (): Promise<DashboardStats> => req<DashboardStats>("/dashboard/stats"),
    recentPRs: (days = 7): Promise<RecentPR[]> =>
      req<RecentPR[]>(`/dashboard/recent-prs${qs({ days })}`),
  },

  trainer: {
    me: (): Promise<Trainer> => req<Trainer>("/trainer/me"),
    update: (body: Partial<TrainerProfile>): Promise<Trainer> =>
      req<Trainer>("/trainer/me", jsonBody("PUT", body)),
    subscription: (): Promise<{ status: string; plan: string | null; renews_at: string | null }> =>
      req("/trainer/subscription"),
  },

  clients: {
    list: (status: "active" | "archived" | "all" = "active"): Promise<ClientPulse[]> =>
      req<ClientPulse[]>(`/clients${qs({ status })}`),
    get: (id: number): Promise<Client> => req<Client>(`/clients/${id}`),
    create: (body: Partial<Client>): Promise<ClientCreateResponse> =>
      req<ClientCreateResponse>("/clients", jsonBody("POST", body)),
    update: (id: number, body: Partial<Client>): Promise<Client> =>
      req<Client>(`/clients/${id}`, jsonBody("PUT", body)),
    archive: (id: number): Promise<Client> => req<Client>(`/clients/${id}/archive`, { method: "POST" }),
    delete: (id: number): Promise<void> => req(`/clients/${id}`, { method: "DELETE" }),
    notes: (id: number): Promise<ClientNote[]> => req<ClientNote[]>(`/clients/${id}/notes`),
    addNote: (id: number, body: string, isTrainerOnly = true, category?: NoteCategory): Promise<ClientNote> =>
      req<ClientNote>(
        `/clients/${id}/notes`,
        jsonBody("POST", { body, is_trainer_only: isTrainerOnly, category: category ?? null })
      ),
    resendInvite: (id: number): Promise<Invite> =>
      req<Invite>(`/clients/${id}/invite/resend`, { method: "POST" }),
    sessions: (id: number, exerciseId?: number): Promise<SessionListItem[]> =>
      req<SessionListItem[]>(`/clients/${id}/sessions${qs({ exercise_id: exerciseId })}`),
    overviewStats: (id: number): Promise<ClientOverviewStats> =>
      req<ClientOverviewStats>(`/clients/${id}/overview-stats`),
    weeklyStats: (id: number, weeks = 12): Promise<ClientWeeklyStats> =>
      req<ClientWeeklyStats>(`/clients/${id}/weekly-stats${qs({ weeks })}`),
    prSummary: (id: number): Promise<ClientPRSummary> =>
      req<ClientPRSummary>(`/clients/${id}/pr-summary`),
    exerciseInsights: (id: number): Promise<ClientExerciseInsights> =>
      req<ClientExerciseInsights>(`/clients/${id}/exercise-insights`),
    programs: (id: number): Promise<ClientProgram[]> => req<ClientProgram[]>(`/clients/${id}/programs`),
    progress: (id: number, exerciseId: number, metric: "1rm" | "weight"): Promise<ProgressResponse> =>
      req<ProgressResponse>(`/clients/${id}/progress${qs({ exercise_id: exerciseId, metric })}`),
    volumeByCategory: (id: number): Promise<VolumeByCategoryResponse> =>
      req<VolumeByCategoryResponse>(`/clients/${id}/volume-by-category`),
    prs: (id: number): Promise<PR[]> => req<PR[]>(`/clients/${id}/prs`),
    badges: (id: number): Promise<ClientBadge[]> => req<ClientBadge[]>(`/clients/${id}/badges`),
    calendar: (id: number, year: number, month: number): Promise<CalendarResponse> =>
      req<CalendarResponse>(`/clients/${id}/calendar${qs({ year, month })}`),
  },

  exercises: {
    list: (params: { category?: string; favorites_only?: boolean } = {}): Promise<Exercise[]> =>
      req<Exercise[]>(`/exercises${qs(params)}`),
    create: (body: Partial<Exercise>): Promise<Exercise> =>
      req<Exercise>("/exercises", jsonBody("POST", body)),
    update: (id: number, body: Partial<Exercise>): Promise<Exercise> =>
      req<Exercise>(`/exercises/${id}`, jsonBody("PUT", body)),
    delete: (id: number): Promise<void> => req(`/exercises/${id}`, { method: "DELETE" }),
    favorite: (id: number): Promise<void> => req(`/exercises/${id}/favorite`, { method: "POST" }),
    unfavorite: (id: number): Promise<void> => req(`/exercises/${id}/favorite`, { method: "DELETE" }),
  },

  programs: {
    list: (): Promise<ProgramSummary[]> => req<ProgramSummary[]>("/programs"),
    get: (id: number): Promise<Program> => req<Program>(`/programs/${id}`),
    create: (body: ProgramCreateInput): Promise<Program> =>
      req<Program>("/programs", jsonBody("POST", body)),
    update: (id: number, body: ProgramCreateInput): Promise<Program> =>
      req<Program>(`/programs/${id}`, jsonBody("PUT", body)),
    delete: (id: number): Promise<void> => req(`/programs/${id}`, { method: "DELETE" }),
    assign: (id: number, clientId: number, startDate?: string): Promise<ClientProgram> =>
      req<ClientProgram>(
        `/programs/${id}/assign`,
        jsonBody("POST", { client_id: clientId, start_date: startDate ?? null })
      ),
  },

  clientPrograms: {
    get: (id: number): Promise<ClientProgram> => req<ClientProgram>(`/client-programs/${id}`),
    update: (id: number, body: Partial<ClientProgram>): Promise<ClientProgram> =>
      req<ClientProgram>(`/client-programs/${id}`, jsonBody("PUT", body)),
  },

  sessions: {
    start: (clientId: number, clientProgramDayId?: number, label?: string): Promise<WorkoutSession> =>
      req<WorkoutSession>(
        "/sessions",
        jsonBody("POST", {
          client_id: clientId,
          client_program_day_id: clientProgramDayId ?? null,
          label,
        })
      ),
    get: (id: number): Promise<WorkoutSession> => req<WorkoutSession>(`/sessions/${id}`),
    update: (id: number, body: Partial<WorkoutSession>): Promise<WorkoutSession> =>
      req<WorkoutSession>(`/sessions/${id}`, jsonBody("PUT", body)),
    cancel: (id: number): Promise<void> => req(`/sessions/${id}`, { method: "DELETE" }),
    logSet: (
      sessionId: number,
      body: Partial<SetEntry> & { exercise_id: number }
    ): Promise<SetEntry> =>
      req<SetEntry>(`/sessions/${sessionId}/sets`, jsonBody("POST", body)),
    updateSet: (setId: number, body: Partial<SetEntry>): Promise<SetEntry> =>
      req<SetEntry>(`/sets/${setId}`, jsonBody("PUT", body)),
    deleteSet: (setId: number): Promise<void> => req(`/sets/${setId}`, { method: "DELETE" }),
    complete: (id: number): Promise<SessionSummary> =>
      req<SessionSummary>(`/sessions/${id}/complete`, { method: "POST" }),
  },

  activity: {
    list: (params: { client_id?: number; limit?: number } = {}): Promise<ActivityEvent[]> =>
      req<ActivityEvent[]>(`/activity${qs(params)}`),
  },

  clientPortal: {
    dashboard: (clientId?: number): Promise<ClientPortalDashboard> =>
      req<ClientPortalDashboard>(`/client-portal/dashboard${qs({ client_id: clientId })}`),
    myWorkouts: (clientId?: number): Promise<ClientMyWorkouts> =>
      req<ClientMyWorkouts>(`/client-portal/my-workouts${qs({ client_id: clientId })}`),
    history: (clientId?: number): Promise<ClientHistory> =>
      req<ClientHistory>(`/client-portal/history${qs({ client_id: clientId })}`),
    workoutDetail: (workoutId: number, clientId?: number): Promise<ClientWorkoutDetail> =>
      req<ClientWorkoutDetail>(`/client-portal/workouts/${workoutId}${qs({ client_id: clientId })}`),
    progress: (range: ProgressRange = "all", clientId?: number): Promise<ClientProgress> =>
      req<ClientProgress>(`/client-portal/progress${qs({ range, client_id: clientId })}`),
    strengthSeries: (exerciseId: number, range: ProgressRange = "all", clientId?: number): Promise<StrengthSeries> =>
      req<StrengthSeries>(
        `/client-portal/progress/strength${qs({ exercise_id: exerciseId, range, client_id: clientId })}`
      ),
    logBodyweight: (weight: number, clientId?: number): Promise<BodyweightLog> =>
      req<BodyweightLog>(`/client-portal/bodyweight${qs({ client_id: clientId })}`, jsonBody("POST", { weight })),
  },

  notifications: {
    list: (unreadOnly = false): Promise<Notification[]> =>
      req<Notification[]>(`/notifications${qs({ unread_only: unreadOnly })}`),
    unreadCount: (): Promise<{ count: number }> =>
      req<{ count: number }>("/notifications/unread-count"),
    markRead: (id: number): Promise<Notification> =>
      req<Notification>(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: (): Promise<{ count: number }> =>
      req<{ count: number }>("/notifications/read-all", { method: "POST" }),
  },

  schedule: {
    list: (start: string, end: string): Promise<ScheduledSession[]> =>
      req<ScheduledSession[]>(`/schedule${qs({ start, end })}`),
    needsReview: (): Promise<ScheduledSession[]> => req<ScheduledSession[]>("/schedule/needs-review"),
    create: (body: {
      client_id: number;
      scheduled_at: string;
      repeat?: RepeatRule | null;
      repeat_until?: string | null;
      notes?: string | null;
    }): Promise<ScheduledSession[]> => req<ScheduledSession[]>("/schedule", jsonBody("POST", body)),
    update: (
      id: number,
      body: { scheduled_at?: string; status?: "upcoming" | "completed" | "cancelled"; notes?: string }
    ): Promise<ScheduledSession> => req<ScheduledSession>(`/schedule/${id}`, jsonBody("PUT", body)),
    cancel: (id: number, scope: "one" | "future"): Promise<ScheduledSession[]> =>
      req<ScheduledSession[]>(`/schedule/${id}/cancel`, jsonBody("POST", { scope })),
    delete: (id: number, scope: "one" | "future" = "one"): Promise<void> =>
      req(`/schedule/${id}${qs({ scope })}`, { method: "DELETE" }),
    startWorkout: (id: number): Promise<WorkoutSession> =>
      req<WorkoutSession>(`/schedule/${id}/start-workout`, { method: "POST" }),
  },
};
