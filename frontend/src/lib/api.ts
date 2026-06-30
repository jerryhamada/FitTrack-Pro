import type {
  ActivityEvent,
  CalendarResponse,
  Client,
  ClientBadge,
  ClientCreateResponse,
  ClientNote,
  ClientProgram,
  ClientPulse,
  Exercise,
  Invite,
  PR,
  Program,
  ProgramCreateInput,
  ProgramSummary,
  ProgressResponse,
  SessionListItem,
  SessionSummary,
  SetEntry,
  Trainer,
  TrainerProfile,
  VolumeByCategoryResponse,
  WorkoutSession,
} from "../types";

const BASE = "/api";

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  return fetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function req<T = void>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
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
  trainer: {
    me: (): Promise<Trainer> => req<Trainer>("/trainer/me"),
    update: (body: Partial<TrainerProfile>): Promise<Trainer> =>
      req<Trainer>("/trainer/me", jsonBody("PUT", body)),
    subscription: (): Promise<{ status: string; plan: string | null; renews_at: string | null }> =>
      req("/trainer/subscription"),
    weeklySummary: (): Promise<{ status: string; message: string }> => req("/trainer/weekly-summary"),
  },

  clients: {
    list: (status: "active" | "archived" = "active"): Promise<ClientPulse[]> =>
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
    exportCsvUrl: (id: number): string => `${BASE}/clients/${id}/export/csv`,
  },

  exercises: {
    list: (params: { category?: string; favorites_only?: boolean } = {}): Promise<Exercise[]> =>
      req<Exercise[]>(`/exercises${qs(params)}`),
    create: (body: Partial<Exercise>): Promise<Exercise> => req<Exercise>("/exercises", jsonBody("POST", body)),
    update: (id: number, body: Partial<Exercise>): Promise<Exercise> =>
      req<Exercise>(`/exercises/${id}`, jsonBody("PUT", body)),
    favorite: (id: number): Promise<void> => req(`/exercises/${id}/favorite`, { method: "POST" }),
    unfavorite: (id: number): Promise<void> => req(`/exercises/${id}/favorite`, { method: "DELETE" }),
  },

  programs: {
    list: (): Promise<ProgramSummary[]> => req<ProgramSummary[]>("/programs"),
    get: (id: number): Promise<Program> => req<Program>(`/programs/${id}`),
    create: (body: ProgramCreateInput): Promise<Program> => req<Program>("/programs", jsonBody("POST", body)),
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
        jsonBody("POST", { client_id: clientId, client_program_day_id: clientProgramDayId ?? null, label })
      ),
    get: (id: number): Promise<WorkoutSession> => req<WorkoutSession>(`/sessions/${id}`),
    update: (id: number, body: Partial<WorkoutSession>): Promise<WorkoutSession> =>
      req<WorkoutSession>(`/sessions/${id}`, jsonBody("PUT", body)),
    logSet: (sessionId: number, body: Partial<SetEntry> & { exercise_id: number }): Promise<SetEntry> =>
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
