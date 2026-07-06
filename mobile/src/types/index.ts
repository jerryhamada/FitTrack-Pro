export type Unit = "lbs" | "kg";
export type DistanceUnit = "in" | "cm";
export type ClientStatus = "active" | "archived";
export type GoalType = "strength" | "hypertrophy" | "fat_loss" | "endurance" | "general_fitness";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
export type EffortType = "rpe" | "rir";
export type SetStatus = "completed" | "partial" | "skipped";
export type PrType = "weight_at_reps" | "estimated_1rm" | "height_at_reps";
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
  default_distance_unit: DistanceUnit;
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
  email: string | null;
  phone: string | null;
  goals: string | null;
  starting_bodyweight: number | null;
  starting_body_fat_pct: number | null;
  preferred_unit: Unit;
  status: ClientStatus;
  goal_type: GoalType | null;
  training_frequency_target: number | null;
  photo_url: string | null;
  age: number | null;
  gender: string | null;
  injuries_limitations: string | null;
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

export type NoteCategory =
  | "technique"
  | "injury"
  | "mobility"
  | "nutrition"
  | "homework"
  | "preferences";

export interface ClientNote {
  id: number;
  body: string;
  category: NoteCategory | null;
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
  muscle_group: string | null;
  secondary_muscles: string[] | null;
  equipment: string | null;
  exercise_type: "compound" | "isolation" | null;
  demo_media_url: string | null;
  instructions_steps: string[] | null;
  tracks_height: boolean;
  invert_difficulty: boolean;
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
  height: number | null;
  height_unit: DistanceUnit | null;
  is_per_side: boolean;
  reps: number | null;
  effort_value: number | null;
  effort_type: EffortType | null;
  set_modifier: string | null;
  status: SetStatus;
  superset_group: string | null;
  notes: string | null;
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

export interface SessionExercise {
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  superset_group_id: string | null;
  superset_order: number | null;
}

export interface ActiveSession {
  id: number;
  client_id: number;
  client_name: string;
  label: string | null;
  started_at: string;
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
  session_exercises: SessionExercise[];
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
  exercise_count: number;
  total_volume: number;
  total_volume_unit: Unit;
  notes_preview: string | null;
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
  unit: Unit | DistanceUnit;
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
  upcoming_sessions: number;
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
  unit: Unit | DistanceUnit;
  achieved_at: string;
}

export interface ClientOverviewStats {
  lifetime_workouts: number;
  lifetime_prs: number;
  hours_trained: number;
  current_streak_weeks: number;
  avg_workouts_per_week: number | null;
  most_improved_lift: string | null;
}

export interface WeeklyStat {
  week_start: string;
  workouts: number;
  volume: number;
}

export interface ClientWeeklyStats {
  unit: Unit;
  weeks: WeeklyStat[];
}

export interface ExercisePRSummary {
  exercise_id: number;
  exercise_name: string;
  best_weight: number | null;
  best_weight_reps: number | null;
  best_e1rm: number | null;
  best_set_volume: number | null;
  pr_count: number;
  last_pr_at: string | null;
}

export interface ClientPRSummary {
  unit: Unit;
  lifetime_pr_count: number;
  prs_this_month: number;
  last_pr_at: string | null;
  exercises: ExercisePRSummary[];
}

export interface BestSet {
  weight: number | null;
  reps: number | null;
  session_date: string;
}

export interface ExerciseInsight {
  exercise_id: number;
  sessions_used: number;
  last_used_at: string;
  last3_best: BestSet[];
}

export interface ClientExerciseInsights {
  unit: Unit;
  exercises: ExerciseInsight[];
}

export type ScheduledStatus = "upcoming" | "completed" | "cancelled";
export type RepeatRule = "weekly" | "biweekly";

export interface ScheduledSession {
  id: number;
  client_id: number;
  client_name: string;
  client_photo_url: string | null;
  scheduled_at: string;
  status: ScheduledStatus;
  repeat_rule: RepeatRule | null;
  series_id: string | null;
  workout_session_id: number | null;
  notes: string | null;
}

export type NotificationType =
  | "client_inactive"
  | "new_pr"
  | "session_reminder"
  | "missed_workout";

export interface Notification {
  id: number;
  type: NotificationType;
  client_id: number | null;
  scheduled_session_id: number | null;
  workout_session_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface PortalNextSession {
  scheduled_at: string;
  trainer_name: string | null;
  notes: string | null;
}

export interface PortalPR {
  exercise_name: string;
  pr_type: string;
  value: number;
  unit: string;
  reps: number | null;
  achieved_at: string;
}

export interface PortalKeyLift {
  exercise_name: string;
  unit: Unit;
  points: { date: string; value: number }[];
}

export interface PortalWorkout {
  id: number;
  started_at: string;
  duration_seconds: number | null;
  exercise_count: number;
  pr_count: number;
}

export interface ClientPortalDashboard {
  client_name: string;
  client_photo_url: string | null;
  trainer_name: string | null;
  trainer_business: string | null;
  unit: Unit;
  next_session: PortalNextSession | null;
  streak_weeks: number;
  workouts_this_month: number;
  lifetime_workouts: number;
  recent_prs: PortalPR[];
  weekly_workouts: { week_start: string; workouts: number }[];
  key_lifts: PortalKeyLift[];
  recent_workouts: PortalWorkout[];
}

export interface PortalPlannedExercise {
  exercise_name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_weight_unit: string | null;
  notes: string | null;
}

export interface PortalUpcomingSession {
  id: number;
  scheduled_at: string;
  status: string;
  trainer_name: string | null;
  notes: string | null;
  plan_label: string | null;
  planned_exercises: PortalPlannedExercise[];
}

export interface PortalCurrentProgram {
  name: string;
  current_week: number | null;
  days_per_week: number;
  goal: string | null;
}

export interface ClientMyWorkouts {
  trainer_name: string | null;
  next_session: PortalUpcomingSession | null;
  upcoming_sessions: PortalUpcomingSession[];
  current_program: PortalCurrentProgram | null;
}

export interface PortalExerciseRef {
  id: number;
  name: string;
}

export interface PortalHistoryItem {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number | null;
  exercises: PortalExerciseRef[];
  pr_count: number;
  total_volume: number;
  total_volume_unit: string;
}

export interface ClientHistory {
  summary: { total_workouts: number; streak_weeks: number; workouts_this_month: number };
  workouts: PortalHistoryItem[];
}

export interface PortalHistorySet {
  set_number: number;
  weight: number | null;
  weight_unit: string | null;
  height: number | null;
  height_unit: string | null;
  reps: number | null;
  effort_value: number | null;
  effort_type: string | null;
  status: string;
  is_pr: boolean;
  pr_type: string | null;
}

export interface PortalWorkoutExercise {
  exercise_id: number;
  exercise_name: string;
  superset_group_id: string | null;
  superset_order: number | null;
  sets: PortalHistorySet[];
}

export interface ClientWorkoutDetail {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume: number;
  total_volume_unit: string;
  pr_count: number;
  notes: string | null;
  exercises: PortalWorkoutExercise[];
}

export type ProgressRange = "4w" | "3m" | "6m" | "all";

export interface BodyweightLog {
  id: number;
  logged_at: string;
  weight: number;
  unit: string;
}

export interface ProgressExerciseOption {
  exercise_id: number;
  exercise_name: string;
  pr_count: number;
}

export interface StrengthPoint {
  date: string;
  value: number;
  is_pr: boolean;
}

export interface StrengthSeries {
  exercise_id: number;
  exercise_name: string;
  unit: Unit;
  points: StrengthPoint[];
}

export interface ClientProgressStats {
  streak_weeks: number;
  total_workouts: number;
  workouts_this_month: number;
  total_prs: number;
  avg_workouts_per_week: number | null;
  most_improved_lift: string | null;
  most_improved_exercise_id: number | null;
}

export interface ClientProgress {
  unit: Unit;
  stats: ClientProgressStats;
  consistency: { week_start: string; workouts: number }[];
  pr_timeline: PortalPR[];
  bodyweight: BodyweightLog[];
  exercise_options: ProgressExerciseOption[];
  default_exercise_id: number | null;
}

export interface WhoAmI {
  role: "trainer" | "client" | null;
  client_id: number | null;
  client_name: string | null;
}
