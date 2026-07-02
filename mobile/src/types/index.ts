export type Unit = "lbs" | "kg";
export type ClientStatus = "active" | "archived";
export type GoalType = "strength" | "hypertrophy" | "fat_loss" | "endurance" | "general_fitness";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
export type EffortType = "rpe" | "rir";
export type SetStatus = "completed" | "partial" | "skipped";
export type PrType = "weight_at_reps" | "estimated_1rm";
export type ActivityEventType =
  | "session_logged"
  | "pr_hit"
  | "invite_sent"
  | "invite_accepted"
  | "badge_earned"
  | "client_added";

export interface TrainerProfile {
  business_name: string | null;
  logo_url: string | null;
  default_unit: Unit;
  notification_prefs: Record<string, unknown> | null;
  subscription_status: string;
}

export interface Trainer {
  id: number;
  email: string | null;
  name: string | null;
  profile: TrainerProfile | null;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  goals: string | null;
  starting_bodyweight: number | null;
  starting_body_fat_pct: number | null;
  preferred_unit: Unit;
  status: ClientStatus;
  goal_type: GoalType | null;
  training_frequency_target: number | null;
  photo_url: string | null;
  created_at: string;
}

export interface ClientPulse extends Client {
  last_session_at: string | null;
  sessions_this_week: number;
  recent_pr_label: string | null;
  is_stale: boolean;
  training_phase: string | null;
  streak_weeks: number;
}

export interface ClientNote {
  id: number;
  body: string;
  is_trainer_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invite {
  id: number;
  token: string;
  status: InviteStatus;
  expires_at: string;
  invite_link: string;
}

export interface ClientCreateResponse {
  client: Client;
  invite: Invite;
}

export interface Exercise {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  notes: string | null;
  is_custom: boolean;
  is_favorite: boolean;
}

export interface ProgramExercise {
  id: number;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_weight_unit: Unit | null;
  target_rpe: number | null;
  target_rest_seconds: number | null;
  notes: string | null;
}

export interface ProgramDay {
  id: number;
  label: string;
  order_index: number;
  exercises: ProgramExercise[];
}

export interface Program {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  days: ProgramDay[];
}

export interface ProgramSummary {
  id: number;
  name: string;
  description: string | null;
  day_count: number;
  created_at: string;
}

export interface ProgramExerciseInput {
  exercise_id: number;
  order_index: number;
  target_sets?: number;
  target_reps?: string;
  target_weight?: number;
  target_weight_unit?: Unit;
  target_rpe?: number;
  target_rest_seconds?: number;
  notes?: string;
}

export interface ProgramDayInput {
  label: string;
  order_index: number;
  exercises: ProgramExerciseInput[];
}

export interface ProgramCreateInput {
  name: string;
  description?: string;
  days: ProgramDayInput[];
}

export interface ClientProgramDay extends ProgramDay {
  day_of_week: number | null;
}

export interface ClientProgram {
  id: number;
  client_id: number;
  source_program_id: number | null;
  name: string;
  assigned_at: string;
  start_date: string | null;
  active: boolean;
  days: ClientProgramDay[];
}

export interface SetEntry {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  set_number: number;
  weight: number | null;
  weight_unit: Unit | null;
  is_per_side: boolean;
  reps: number | null;
  effort_value: number | null;
  effort_type: EffortType | null;
  set_modifier: string | null;
  status: SetStatus;
  superset_group: string | null;
  is_pr: boolean;
  pr_type: PrType | null;
  created_at: string;
}

export interface PlannedExercise {
  exercise_id: number;
  exercise_name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_weight_unit: Unit | null;
  target_rpe: number | null;
  target_rest_seconds: number | null;
  notes: string | null;
}

export interface WorkoutSession {
  id: number;
  client_id: number;
  client_program_day_id: number | null;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  sets: SetEntry[];
  planned_exercises: PlannedExercise[];
}

export interface SessionListItem {
  id: number;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  set_count: number;
  pr_count: number;
}

export interface SessionSummary {
  session_id: number;
  total_volume: number;
  total_volume_unit: Unit;
  total_sets: number;
  duration_seconds: number | null;
  prs_hit: SetEntry[];
}

export interface PR {
  id: number;
  exercise_id: number;
  exercise_name: string;
  pr_type: PrType;
  reps: number | null;
  value: number;
  unit: Unit;
  achieved_at: string;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
}

export interface ClientBadge {
  badge: Badge;
  earned_at: string;
}

export interface ProgressPoint {
  date: string;
  value: number;
}

export interface ProgressResponse {
  exercise_id: number;
  exercise_name: string;
  metric: "1rm" | "weight";
  unit: Unit;
  points: ProgressPoint[];
}

export interface VolumeByCategoryPoint {
  period_start: string;
  category: string;
  total_volume: number;
}

export interface VolumeByCategoryResponse {
  unit: Unit;
  points: VolumeByCategoryPoint[];
}

export interface CalendarSession {
  id: number;
  label: string | null;
  category: string | null;
  started_at: string;
}

export interface CalendarDay {
  date: string;
  sessions: CalendarSession[];
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: CalendarDay[];
}

export interface ActivityEvent {
  id: number;
  client_id: number | null;
  client_name: string | null;
  event_type: ActivityEventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DashboardStats {
  active_clients: number;
  workouts_today: number;
  workouts_this_week: number;
  workouts_all_time: number;
  adherence_pct: number | null;
  prs_last_7_days: number;
  inactive_clients: number;
  lifetime_prs: number;
  avg_sessions_per_client: number | null;
  hours_coached_this_week: number;
  top_categories: CategoryCount[];
}

export interface RecentPR {
  id: number;
  client_id: number;
  client_name: string;
  exercise_name: string;
  pr_type: PrType;
  reps: number | null;
  value: number;
  unit: Unit;
  achieved_at: string;
}
