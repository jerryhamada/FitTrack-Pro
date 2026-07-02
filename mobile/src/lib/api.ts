import type {
  ActivityEvent,
  CalendarResponse,
  Client,
  ClientBadge,
  ClientCreateResponse,
  ClientNote,
  ClientProgram,
  ClientPulse,
  DashboardStats,
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

// When running on a physical device, replace this with your Mac's local IP.
// On simulator/emulator you can use http://localhost:8010
export const API_BASE_URL = "http://192.168.1.242:8010";

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
    notes: (id: number): Promise<ClientNote[]> => req<ClientNote[]>(`/clients/${id}/notes`),
    addNote: (id: number, body: string, isTrainerOnly = true): Promise<ClientNote> =>
      req<ClientNote>(`/clients/${id}/notes`, jsonBody("POST", { body, is_trainer_only: isTrainerOnly })),
    resendInvite: (id: number): Promise<Invite> =>
      req<Invite>(`/clients/${id}/invite/resend`, { method: "POST" }),
    sessions: (id: number): Promise<SessionListItem[]> => req<SessionListItem[]>(`/clients/${id}/sessions`),
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
};
