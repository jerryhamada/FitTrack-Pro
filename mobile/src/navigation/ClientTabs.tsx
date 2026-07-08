import { useClerk } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Btn from "../components/Btn";
import { api } from "../lib/api";
import { colors, font, radius, spacing } from "../theme";
import FindTrainerScreen from "../screens/FindTrainerScreen";
import ClientDashboardScreen from "../screens/ClientDashboardScreen";
import ClientHistoryScreen from "../screens/ClientHistoryScreen";
import ClientMyWorkoutsScreen from "../screens/ClientMyWorkoutsScreen";
import ClientProgressScreen from "../screens/ClientProgressScreen";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: "home-outline",
  "My Workouts": "clipboard-text-outline",
  History: "history",
  Progress: "chart-line",
  Account: "account-circle-outline",
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

/** Minimal account screen for logged-in clients: who they are, trainer link
 * status ("link later in Settings" lives here), and sign out. */
function ClientAccountScreen() {
  const { signOut } = useClerk();
  const { data: me } = useQuery({ queryKey: ["whoami"], queryFn: api.auth.whoami });
  const [findTrainerOpen, setFindTrainerOpen] = useState(false);

  const linkStatus = me?.trainer_link_status ?? null;

  return (
    <View style={styles.accountContainer}>
      <View style={styles.accountCard}>
        <Text style={styles.accountName}>{me?.client_name ?? "Your account"}</Text>
        <Text style={styles.accountHint}>Client account</Text>
      </View>

      {linkStatus === "pending" && (
        <View style={styles.linkCard}>
          <Text style={styles.linkTitle}>Trainer request pending</Text>
          <Text style={styles.linkText}>
            Your connect request has been sent — your trainer just needs to accept it.
          </Text>
        </View>
      )}
      {linkStatus === "none" && (
        <View style={styles.linkCard}>
          <Text style={styles.linkTitle}>No trainer linked</Text>
          <Text style={styles.linkText}>
            Training with someone? Connect your account so they can program your workouts.
          </Text>
          <Btn label="Find your trainer" fullWidth onPress={() => setFindTrainerOpen(true)} />
        </View>
      )}

      <Btn
        label="Sign out"
        variant="danger"
        fullWidth
        onPress={() =>
          Alert.alert("Sign out", "Sign out of your account?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])
        }
      />

      <Modal
        visible={findTrainerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFindTrainerOpen(false)}
      >
        <FindTrainerScreen onDone={() => setFindTrainerOpen(false)} />
      </Modal>
    </View>
  );
}

/**
 * The client-facing bottom tabs. Rendered for real client logins (with the
 * Account tab for sign-out) and reused by the dev-only trainer preview
 * (ClientPreviewScreen), which hides Account since the preview isn't a login.
 */
export default function ClientTabs({
  includeAccount = false,
  topInset = true,
}: {
  includeAccount?: boolean;
  // The dev preview wraps these tabs under its own inset-padded banner.
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg, paddingTop: topInset ? insets.top : 0 },
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
      {includeAccount && <Tab.Screen name="Account" component={ClientAccountScreen} />}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  accountContainer: { flex: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.xl },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  accountName: { fontSize: font.lg, fontWeight: "700", color: colors.white },
  accountHint: { fontSize: font.sm, color: colors.muted },
  linkCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  linkTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  linkText: { fontSize: font.sm, color: colors.muted, lineHeight: 20 },
});
