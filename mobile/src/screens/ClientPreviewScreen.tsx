import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoleOverride } from "../contexts/RoleOverride";
import { colors, font, spacing } from "../theme";
import ClientDashboardScreen from "./ClientDashboardScreen";
import ClientHistoryScreen from "./ClientHistoryScreen";
import ClientProgressScreen from "./ClientProgressScreen";
import ClientMyWorkoutsScreen from "./ClientMyWorkoutsScreen";

const Tab = createBottomTabNavigator();

function ClientTabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = { Home: "🏠", "My Workouts": "🗓", History: "📖", Progress: "📈" };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{icons[name] ?? "•"}</Text>
  );
}

/**
 * DEV ONLY — shell rendered when the Settings role override is set to "client".
 * Hosts the client-facing bottom tabs (Home + My Workouts) with a preview banner
 * and an escape hatch back to the trainer view. Only ever mounted from the
 * dev-gated router branch; real client logins would mount this navigator directly.
 */
export default function ClientPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { clearOverride } = useRoleOverride();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.previewBanner} onPress={clearOverride}>
        <Text style={styles.previewBannerText}>DEV PREVIEW — CLIENT VIEW · tap to exit</Text>
      </TouchableOpacity>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarIcon: ({ focused }) => <ClientTabIcon name={route.name} focused={focused} />,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        })}
      >
        <Tab.Screen name="Home" component={ClientDashboardScreen} />
        <Tab.Screen name="My Workouts" component={ClientMyWorkoutsScreen} />
        <Tab.Screen name="History" component={ClientHistoryScreen} />
        <Tab.Screen name="Progress" component={ClientProgressScreen} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  previewBanner: {
    backgroundColor: "#3b82f6",
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
  },
  previewBannerText: { color: colors.white, fontSize: font.xs, fontWeight: "700", letterSpacing: 1 },
});
