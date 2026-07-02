import { useAuth } from "@clerk/clerk-expo";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
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
import RecentPRsScreen from "../screens/RecentPRsScreen";
import SessionLogScreen from "../screens/SessionLogScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SignInScreen from "../screens/SignInScreen";
import SignUpScreen from "../screens/SignUpScreen";
import { DEV_BYPASS_AUTH } from "../lib/devAuth";
import { colors } from "../theme";
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

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: "⊞",
    Clients: "👥",
    Exercises: "🏋",
    Programs: "📋",
    Activity: "📈",
    Settings: "⚙",
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? colors.accent : colors.muted }}>
      {icons[name] ?? "•"}
    </Text>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        sceneStyle: { backgroundColor: colors.bg, paddingTop: insets.top },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name.replace("Tab", "")} focused={focused} />
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        headerShown: false,
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: "Dashboard" }} />
      <Tab.Screen name="ClientsTab" component={ClientsScreen} options={{ title: "Clients" }} />
      <Tab.Screen name="ExercisesTab" component={ExerciseLibraryScreen} options={{ title: "Exercises" }} />
      <Tab.Screen name="ProgramsTab" component={ProgramsListScreen} options={{ title: "Programs" }} />
      <Tab.Screen name="ActivityTab" component={ActivityScreen} options={{ title: "Activity" }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "Settings" }} />
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
      <RootStack.Screen name="SessionLog" component={SessionLogScreen} options={{ title: "Session" }} />
      <RootStack.Screen
        name="SessionSummary"
        component={SessionSummaryScreen}
        options={{ title: "Summary", headerBackVisible: false }}
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
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  if (DEV_BYPASS_AUTH) return <AppNavigator />;
  if (!isLoaded) return null;
  return isSignedIn ? <AppNavigator /> : <AuthNavigator />;
}
