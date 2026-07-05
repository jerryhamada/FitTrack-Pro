import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PreviewClientProvider } from "../contexts/PreviewClient";
import { useRoleOverride } from "../contexts/RoleOverride";
import { api } from "../lib/api";
import { colors, font, spacing } from "../theme";
import ClientDashboardScreen from "./ClientDashboardScreen";
import ClientHistoryScreen from "./ClientHistoryScreen";
import ClientProgressScreen from "./ClientProgressScreen";
import ClientMyWorkoutsScreen from "./ClientMyWorkoutsScreen";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: "home-outline",
  "My Workouts": "clipboard-text-outline",
  History: "history",
  Progress: "chart-line",
};

function ClientTabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <MaterialCommunityIcons
      name={TAB_ICONS[name] ?? "circle-outline"}
      size={24}
      color={focused ? colors.accent : colors.muted}
    />
  );
}

/**
 * DEV ONLY — shell rendered when the Settings role override is set to "client".
 * Hosts the client-facing bottom tabs with a preview banner and an escape hatch
 * back to the trainer view. Defaults the previewed client to Ava Burkley (resolved
 * by name from the roster) so the screens show a real client with rich history;
 * falls back to the backend's default client if no such client exists.
 */
export default function ClientPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { clearOverride } = useRoleOverride();

  const { data: clients } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: () => api.clients.list("active"),
  });

  // Prefer a client literally named "Ava Burkley"; if there are duplicates, take
  // the one with the most recent session (the real, well-populated account).
  const previewClientId = useMemo(() => {
    const matches = (clients ?? []).filter(
      (c) => c.name.trim().toLowerCase() === "ava burkley"
    );
    if (matches.length === 0) return undefined;
    return [...matches].sort((a, b) => {
      const at = a.last_session_at ? new Date(a.last_session_at).getTime() : 0;
      const bt = b.last_session_at ? new Date(b.last_session_at).getTime() : 0;
      return bt - at;
    })[0].id;
  }, [clients]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.previewBanner} onPress={clearOverride}>
        <Text style={styles.previewBannerText}>DEV PREVIEW — CLIENT VIEW · tap to exit</Text>
      </TouchableOpacity>
      <PreviewClientProvider value={previewClientId}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            sceneStyle: { backgroundColor: colors.bg },
            tabBarIcon: ({ focused }) => <ClientTabIcon name={route.name} focused={focused} />,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.muted,
            tabBarShowLabel: false,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
          })}
        >
          <Tab.Screen name="Home" component={ClientDashboardScreen} />
          <Tab.Screen name="My Workouts" component={ClientMyWorkoutsScreen} />
          <Tab.Screen name="History" component={ClientHistoryScreen} />
          <Tab.Screen name="Progress" component={ClientProgressScreen} />
        </Tab.Navigator>
      </PreviewClientProvider>
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
