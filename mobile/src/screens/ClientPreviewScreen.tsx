import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoleOverride } from "../contexts/RoleOverride";
import { colors, font, spacing } from "../theme";
import ClientDashboardScreen from "./ClientDashboardScreen";

/**
 * DEV ONLY — shell rendered when the Settings role override is set to "client".
 * Wraps the real client dashboard with a preview banner and an escape hatch
 * back to the trainer view. Only ever mounted from the dev-gated router branch;
 * real client logins would route to ClientDashboardScreen directly.
 */
export default function ClientPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { clearOverride } = useRoleOverride();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.previewBanner} onPress={clearOverride}>
        <Text style={styles.previewBannerText}>DEV PREVIEW — CLIENT VIEW · tap to exit</Text>
      </TouchableOpacity>
      <ClientDashboardScreen />
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
