import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSignupRole } from "../contexts/SignupRole";
import type { AuthStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

function RoleCard({
  icon,
  title,
  subtext,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtext: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={icon} size={26} color={colors.accent} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtext}>{subtext}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function RoleSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { setRole } = useSignupRole();

  function choose(role: "trainer" | "client") {
    setRole(role);
    navigation.navigate("SignUp", { role });
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>
          FitTrack <Text style={styles.logoAccent}>Pro</Text>
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.headline}>How will you use FitTrack Pro?</Text>
        <RoleCard
          icon="whistle-outline"
          title="I'm a Trainer"
          subtext="Manage clients, log workouts, track progress"
          onPress={() => choose("trainer")}
        />
        <RoleCard
          icon="account-outline"
          title="I'm a Client"
          subtext="Follow your program, track your progress"
          onPress={() => choose("client")}
        />
      </View>

      <TouchableOpacity onPress={() => navigation.navigate("SignIn")} style={styles.switchBtn}>
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchLink}>Log in</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, paddingTop: 80 },
  logo: { alignItems: "center" },
  logoText: { fontSize: 32, fontWeight: "800", color: colors.white },
  logoAccent: { color: colors.accent },
  body: { flex: 1, justifyContent: "center", gap: spacing.base },
  headline: {
    fontSize: font.xl,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: "700", color: colors.white },
  cardSubtext: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  switchBtn: { alignItems: "center", paddingBottom: spacing.xl },
  switchText: { fontSize: font.sm, color: colors.muted },
  switchLink: { color: colors.accent, fontWeight: "600" },
});
