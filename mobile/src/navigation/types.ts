import type { SessionSummary } from "../types";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddClient: undefined;
  ClientProfile: { clientId: number };
  ClientsList: { filter?: "inactive"; autoFocusSearch?: boolean; pick?: boolean } | undefined;
  RecentPRs: undefined;
  SessionLog: { sessionId: number };
  SessionSummary: { sessionId: number; summary?: SessionSummary; clientId?: number };
  ProgramsList: undefined;
  ProgramBuilder: { programId?: number };
};

export type TabParamList = {
  DashboardTab: undefined;
  ClientsTab: { filter?: "active" | "inactive"; autoFocusSearch?: boolean } | undefined;
  ExercisesTab: undefined;
  ProgramsTab: undefined;
  ActivityTab: undefined;
  SettingsTab: undefined;
};
