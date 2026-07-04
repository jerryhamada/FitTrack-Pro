import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import ClientPreviewScreen from "../screens/ClientPreviewScreen";
import { useRoleOverride } from "../contexts/RoleOverride";
import { api } from "../lib/api";
import { DEV_BYPASS_AUTH } from "../lib/devAuth";
import { IS_DEV_BUILD } from "../lib/env";
import { colors, font, radius, spacing } from "../theme";
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
  return (
    <AuthStack.Navigator screenOptions={{ ...stackHeaderStyle, headerShown: false }}>
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
        options={({ route, navigation }) => ({
          title: "Workout Summary",
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.completeHeaderBtn}
              activeOpacity={0.85}
              onPress={() => {
                const { clientId } = route.params;
                if (clientId) navigation.replace("ClientProfile", { clientId });
                else navigation.replace("MainTabs");
              }}
            >
              <Text style={styles.completeHeaderBtnText}>Complete</Text>
            </TouchableOpacity>
          ),
        })}
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

export default function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  const { override } = useRoleOverride();

  // DEV ONLY: session role override from Settings → Developer Options. The provider
  // is inert in production builds, so this branch is unreachable there.
  if (IS_DEV_BUILD && override === "client") return <ClientPreviewScreen />;

  if (DEV_BYPASS_AUTH) return <AppNavigator />;
  if (!isLoaded) return null;
  return isSignedIn ? <AppNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
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
  completeHeaderBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginLeft: spacing.base,
  },
  completeHeaderBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: font.sm,
  },
});
