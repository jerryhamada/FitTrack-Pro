import type { SessionSummary } from "../types";

export type AuthStackParamList = {
  SignIn: undefined;
  RoleSelect: undefined;
  SignUp: { role?: "trainer" | "client" } | undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddClient: undefined;
  ClientProfile: { clientId: number; initialTab?: "Overview" | "History" | "PRs" | "Notes" | "Programs" };
  Notifications: undefined;
  ClientsList: { filter?: "inactive"; autoFocusSearch?: boolean; pick?: boolean } | undefined;
  RecentPRs: undefined;
  SessionLog: { sessionId: number };
  SessionSummary: { sessionId: number; summary?: SessionSummary };
  ProgramsList: undefined;
  ProgramBuilder: { programId?: number };
  // Not currently linked from any tab or menu — kept reachable in case Schedule
  // gets a re-entry point later. Not deleted, just unlinked per product request.
  Schedule: undefined;
  Activity: undefined;
};

export type TabParamList = {
  DashboardTab: undefined;
  ClientsTab: { filter?: "active" | "inactive"; autoFocusSearch?: boolean } | undefined;
  // Dummy tab — its tabBarButton is fully overridden to a raised action button
  // that never actually navigates to this screen. See navigation/index.tsx.
  CurrentWorkoutTab: undefined;
  ExercisesTab: undefined;
  SettingsTab: undefined;
};
