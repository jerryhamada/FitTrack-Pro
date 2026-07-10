import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActivityScreen from "../screens/ActivityScreen";
import AddClientScreen from "../screens/AddClientScreen";
import ClientProfileScreen from "../screens/ClientProfileScreen";
import ClientsListScreen from "../screens/ClientsListScreen";
import ClientsScreen from "../screens/ClientsScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ExerciseLibraryScreen from "../screens/ExerciseLibraryScreen";
import ProgramBuilderScreen from "../screens/ProgramBuilderScreen";
import ProgramsListScreen from "../screens/ProgramsListScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import RecentPRsScreen from "../screens/RecentPRsScreen";
import SessionLogScreen from "../screens/SessionLogScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SignInScreen from "../screens/SignInScreen";
import SignUpScreen from "../screens/SignUpScreen";
import RoleSelectScreen from "../screens/RoleSelectScreen";
import FindTrainerScreen from "../screens/FindTrainerScreen";
import ClientPreviewScreen from "../screens/ClientPreviewScreen";
import { usePendingInvite } from "../contexts/PendingInvite";
import { useSignupRole } from "../contexts/SignupRole";
import { useRoleOverride } from "../contexts/RoleOverride";
import { api } from "../lib/api";
import ClientTabs from "./ClientTabs";
import { DEV_BYPASS_AUTH } from "../lib/devAuth";
import { IS_DEV_BUILD } from "../lib/env";
import { colors } from "../theme";
import type { ActiveSession } from "../types";
import type { AuthStackParamList, RootStackParamList, TabParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const stackHeaderStyle = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.white,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal" as const,
};

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  DashboardTab: "view-dashboard-outline",
  ClientsTab: "account-group-outline",
  ExercisesTab: "dumbbell",
  SettingsTab: "cog-outline",
};

function TabIcon({ routeName, focused }: { routeName: string; focused: boolean }) {
  return (
    <MaterialCommunityIcons
      name={TAB_ICONS[routeName] ?? "help-circle-outline"}
      size={24}
      color={focused ? colors.accent : colors.muted}
    />
  );
}

// Placeholder for the "Current Workout" tab slot — its tabBarButton is fully
// replaced with a custom button (see CurrentWorkoutButton below), so this
// screen never actually renders.
function NoopScreen() {
  return null;
}

function formatElapsedShort(startedAt: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CurrentWorkoutButton({
  activeSession,
  now,
  onPress,
  checking,
}: {
  activeSession: ActiveSession | null;
  now: number;
  onPress: () => void;
  checking: boolean;
}) {
  // Same row, same level as the other tab icons — no raise, no notch. When a
  // workout is running this slot becomes a live-ticking timer pill instead of
  // the idle play circle, so the trainer always knows a session is in progress.
  if (activeSession) {
    return (
      <View style={styles.tabSlot}>
        <TouchableOpacity style={styles.timerPill} onPress={onPress} activeOpacity={0.85}>
          <View style={styles.timerDot} />
          <Text style={styles.timerText}>{formatElapsedShort(activeSession.started_at, now)}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.tabSlot}>
      <TouchableOpacity
        style={styles.idleCircle}
        onPress={onPress}
        disabled={checking}
        activeOpacity={0.85}
      >
        {checking ? (
          <ActivityIndicator size="small" color={colors.bg} />
        ) : (
          <MaterialCommunityIcons name="play" size={20} color={colors.bg} />
        )}
      </TouchableOpacity>
    </View>
  );
}

type MainTabsProps = NativeStackScreenProps<RootStackParamList, "MainTabs">;

function MainTabs({ navigation }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const [checkingActive, setCheckingActive] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Poll for an in-progress session so the button reflects reality even if it
  // was started/finished somewhere we didn't explicitly invalidate this key.
  const { data: activeSession } = useQuery({
    queryKey: ["sessions", "active"],
    queryFn: api.sessions.active,
    refetchInterval: 20_000,
  });
  const hasActive = !!activeSession;

  // Tick the displayed timer once a second, but only while a session is live.
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasActive]);

  async function handleCurrentWorkoutPress() {
    // Already known to be active — resume instantly, no round trip needed.
    if (activeSession) {
      navigation.navigate("SessionLog", { sessionId: activeSession.id });
      return;
    }
    // Idle per our last poll — double-check before deciding, in case a session
    // was started very recently and hasn't been picked up yet.
    if (checkingActive) return;
    setCheckingActive(true);
    try {
      const fresh = await api.sessions.active();
      if (fresh) {
        navigation.navigate("SessionLog", { sessionId: fresh.id });
      } else {
        navigation.navigate("ClientsList", { pick: true });
      }
    } catch {
      Alert.alert("Error", "Couldn't check your current workout. Try again.");
    } finally {
      setCheckingActive(false);
    }
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        sceneStyle: { backgroundColor: colors.bg, paddingTop: insets.top },
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} />
      <Tab.Screen name="ClientsTab" component={ClientsScreen} />
      <Tab.Screen
        name="CurrentWorkoutTab"
        component={NoopScreen}
        options={{
          tabBarButton: () => (
            <CurrentWorkoutButton
              activeSession={activeSession ?? null}
              now={now}
              onPress={handleCurrentWorkoutPress}
              checking={checkingActive}
            />
          ),
        }}
      />
      <Tab.Screen name="ExercisesTab" component={ExerciseLibraryScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  // Role selection ("trainer or client?") is the entry point; existing users
  // reach Sign In via the "Already have an account?" link.
  return (
    <AuthStack.Navigator
      initialRouteName="RoleSelect"
      screenOptions={{ ...stackHeaderStyle, headerShown: false }}
    >
      <AuthStack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        ...stackHeaderStyle,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen name="AddClient" component={AddClientScreen} options={{ title: "Add Client" }} />
      <RootStack.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={{ title: "Client" }}
      />
      <RootStack.Screen
        name="ClientsList"
        component={ClientsListScreen}
        options={{ title: "Clients" }}
      />
      <RootStack.Screen
        name="RecentPRs"
        component={RecentPRsScreen}
        options={{ title: "Recent PRs" }}
      />
      <RootStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
      <RootStack.Screen name="SessionLog" component={SessionLogScreen} options={{ title: "Session" }} />
      <RootStack.Screen
        name="SessionSummary"
        component={SessionSummaryScreen}
        options={{ title: "Workout Summary" }}
      />
      <RootStack.Screen
        name="ProgramsList"
        component={ProgramsListScreen}
        options={{ title: "Programs" }}
      />
      <RootStack.Screen
        name="ProgramBuilder"
        component={ProgramBuilderScreen}
        options={{ title: "Program Builder" }}
      />
      {/* Not linked from any tab or menu right now — kept reachable in case these
          get a re-entry point later, per product decision to unlink rather than delete. */}
      <RootStack.Screen name="Schedule" component={ScheduleScreen} options={{ title: "Schedule" }} />
      <RootStack.Screen name="Activity" component={ActivityScreen} options={{ title: "Activity" }} />
    </RootStack.Navigator>
  );
}

function FullScreenStatus({ children }: { children: React.ReactNode }) {
  return <View style={styles.statusScreen}>{children}</View>;
}

/**
 * Post-auth routing. If the login arrived through an invite link, redeem it
 * first (that's what links the login to the trainer's Client row and makes it
 * a client account), then route by the backend's role resolution: clients get
 * the client portal tabs, everyone else gets the trainer app.
 *
 * A login that picked "I'm a Client" at signup (no invite) gets provisioned as
 * a standalone client account here, then runs the Find Your Trainer step
 * before landing on the client dashboard.
 */
function SignedInRouter() {
  const { token, clearToken, joinCode, clearJoinCode } = usePendingInvite();
  const { role: signupRole, hydrated: roleHydrated, setRole, clearRole } = useSignupRole();
  const { signOut } = useAuth();
  const qc = useQueryClient();

  const whoami = useQuery({
    queryKey: ["whoami"],
    queryFn: api.auth.whoami,
    enabled: token === null,
    staleTime: Infinity,
  });

  const redeem = useMutation({
    mutationFn: () => api.clientPortal.redeemInvite(token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whoami"] });
      clearToken();
    },
    meta: { skipGlobalToast: true },
  });
  const { mutate: redeemMutate, status: redeemStatus } = redeem;

  useEffect(() => {
    if (token !== null && redeemStatus === "idle") redeemMutate();
  }, [token, redeemStatus, redeemMutate]);

  // "I'm a Client" signup without an invite (role choice or a pending trainer
  // join code): provision the standalone client account, then re-resolve.
  const registerClient = useMutation({
    mutationFn: api.auth.registerClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whoami"] }),
    meta: { skipGlobalToast: true },
  });
  const { mutate: registerMutate, status: registerStatus } = registerClient;
  const needsClientProvisioning =
    token === null &&
    roleHydrated &&
    (signupRole === "client" || joinCode !== null) &&
    whoami.data !== undefined &&
    whoami.data.role === null;

  useEffect(() => {
    if (needsClientProvisioning && registerStatus === "idle") registerMutate();
  }, [needsClientProvisioning, registerStatus, registerMutate]);

  // Trainer join code captured at signup: once the login resolves as a client,
  // link it to the trainer. Success and "already connected" both just clear the
  // code; real failures surface with a retry / continue-without-it choice.
  const joinByCode = useMutation({
    mutationFn: () => api.clientPortal.joinByCode(joinCode!),
    onSuccess: () => {
      clearJoinCode();
      qc.invalidateQueries({ queryKey: ["whoami"] });
    },
    meta: { skipGlobalToast: true },
  });
  const { mutate: joinMutate, status: joinStatus } = joinByCode;
  const needsJoinByCode =
    token === null &&
    joinCode !== null &&
    whoami.data !== undefined &&
    whoami.data.role === "client" &&
    whoami.data.trainer_link_status !== "linked";

  useEffect(() => {
    if (needsJoinByCode && joinStatus === "idle") joinMutate();
  }, [needsJoinByCode, joinStatus, joinMutate]);

  // A join code makes no sense for a resolved trainer login — drop it so the
  // trainer app renders instead of a stuck linking state.
  useEffect(() => {
    if (joinCode !== null && whoami.data?.role === "trainer") clearJoinCode();
  }, [joinCode, whoami.data?.role, clearJoinCode]);

  // Once the account's role is settled, drop the persisted signup choice so a
  // stale value can never steer a future login. ("client" is kept while the
  // Find Your Trainer step still needs it.)
  const resolvedRole = whoami.data?.role;
  const linkStatus = whoami.data?.role === "client" ? whoami.data.trainer_link_status : undefined;
  useEffect(() => {
    if (signupRole === null) return;
    if (resolvedRole === "trainer") clearRole();
    if (resolvedRole === "client" && linkStatus !== "none") clearRole();
  }, [signupRole, resolvedRole, linkStatus, clearRole]);

  if (token !== null) {
    if (redeem.isError) {
      return (
        <FullScreenStatus>
          <Text style={styles.statusTitle}>Couldn't join with this invite</Text>
          <Text style={styles.statusMessage}>{(redeem.error as Error).message}</Text>
          <TouchableOpacity style={styles.statusBtn} onPress={() => redeem.reset()}>
            <Text style={styles.statusBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.statusLink}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearToken}>
            <Text style={styles.statusLink}>Continue without the invite</Text>
          </TouchableOpacity>
        </FullScreenStatus>
      );
    }
    return (
      <FullScreenStatus>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.statusMessage}>Linking your account to your trainer...</Text>
      </FullScreenStatus>
    );
  }

  if (whoami.isError) {
    return (
      <FullScreenStatus>
        <Text style={styles.statusTitle}>Couldn't load your account</Text>
        <Text style={styles.statusMessage}>{(whoami.error as Error).message}</Text>
        <TouchableOpacity style={styles.statusBtn} onPress={() => whoami.refetch()}>
          <Text style={styles.statusBtnText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => signOut()}>
          <Text style={styles.statusLink}>Sign out</Text>
        </TouchableOpacity>
      </FullScreenStatus>
    );
  }
  // Don't make any role decision until both the backend's answer AND the
  // persisted signup choice are in — deciding early is how a brand-new client
  // login used to fall into the trainer app.
  if (whoami.data === undefined || !roleHydrated) {
    return (
      <FullScreenStatus>
        <ActivityIndicator color={colors.accent} />
      </FullScreenStatus>
    );
  }

  if (needsJoinByCode) {
    if (joinByCode.isError) {
      return (
        <FullScreenStatus>
          <Text style={styles.statusTitle}>Couldn't join with this code</Text>
          <Text style={styles.statusMessage}>{(joinByCode.error as Error).message}</Text>
          <TouchableOpacity style={styles.statusBtn} onPress={() => joinByCode.reset()}>
            <Text style={styles.statusBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              joinByCode.reset();
              clearJoinCode();
            }}
          >
            <Text style={styles.statusLink}>Continue without the code</Text>
          </TouchableOpacity>
        </FullScreenStatus>
      );
    }
    return (
      <FullScreenStatus>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.statusMessage}>Linking you to your trainer...</Text>
      </FullScreenStatus>
    );
  }

  if (needsClientProvisioning) {
    if (registerClient.isError) {
      return (
        <FullScreenStatus>
          <Text style={styles.statusTitle}>Couldn't set up your client account</Text>
          <Text style={styles.statusMessage}>{(registerClient.error as Error).message}</Text>
          <TouchableOpacity style={styles.statusBtn} onPress={() => registerClient.reset()}>
            <Text style={styles.statusBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.statusLink}>Sign out</Text>
          </TouchableOpacity>
        </FullScreenStatus>
      );
    }
    return (
      <FullScreenStatus>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.statusMessage}>Setting up your account...</Text>
      </FullScreenStatus>
    );
  }

  if (whoami.data.role === "client") {
    // Fresh client signup with no trainer yet → Find Your Trainer, with a
    // persistent skip. Sending a request or skipping both land on the dashboard.
    if (signupRole === "client" && whoami.data.trainer_link_status === "none") {
      return <FindTrainerScreen onDone={clearRole} />;
    }
    return <ClientTabs includeAccount />;
  }

  // role null with NO recorded choice: never silently default to trainer — the
  // trainer app's first API call would permanently provision this login as a
  // trainer. Ask explicitly instead (covers OAuth signups from the Sign In
  // screen and sessions restored after the app was killed mid-signup).
  if (whoami.data.role === null && signupRole !== "trainer") {
    return (
      <FullScreenStatus>
        <Text style={styles.statusTitle}>How will you use FitTrack Pro?</Text>
        <Text style={styles.statusMessage}>
          Tell us which side of the app this account is for — this only needs to happen once.
        </Text>
        <TouchableOpacity style={styles.statusBtn} onPress={() => setRole("trainer")}>
          <Text style={styles.statusBtnText}>I'm a Trainer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statusBtn} onPress={() => setRole("client")}>
          <Text style={styles.statusBtnText}>I'm a Client</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => signOut()}>
          <Text style={styles.statusLink}>Sign out</Text>
        </TouchableOpacity>
      </FullScreenStatus>
    );
  }

  // role "trainer", or role null with an explicit "I'm a Trainer" choice (the
  // backend auto-provisions the trainer account on first trainer API call).
  return <AppNavigator />;
}

export default function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  const { override } = useRoleOverride();

  // DEV ONLY: session role override from Settings → Developer Options. The provider
  // is inert in production builds, so this branch is unreachable there.
  if (IS_DEV_BUILD && override === "client") return <ClientPreviewScreen />;

  if (DEV_BYPASS_AUTH) return <AppNavigator />;
  if (!isLoaded) return null;
  if (!isSignedIn) return <AuthNavigator />;
  return <SignedInRouter />;
}

const styles = StyleSheet.create({
  statusScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  statusTitle: { color: colors.white, fontSize: 17, fontWeight: "700", textAlign: "center" },
  statusMessage: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  statusBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  statusBtnText: { color: "#000", fontSize: 14, fontWeight: "700" },
  statusLink: { color: colors.muted, fontSize: 13, textDecorationLine: "underline" },
  tabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  idleCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.danger,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  timerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
