import { useSignIn } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Btn from "../components/Btn";
import Input from "../components/Input";
import OAuthButtons from "../components/OAuthButtons";
import { clerkErrorMessage } from "../lib/clerkError";
import { getWelcomeName } from "../lib/welcomeName";
import type { AuthStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export default function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcomeName, setWelcomeNameState] = useState<string | null>(null);

  useEffect(() => {
    getWelcomeName().then(setWelcomeNameState);
  }, []);

  async function handleSignIn() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      } else {
        Alert.alert("Sign in failed", "Unable to complete sign in. Please try again.");
      }
    } catch (err: unknown) {
      Alert.alert("Error", clerkErrorMessage(err, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            FitTrack <Text style={styles.logoAccent}>Pro</Text>
          </Text>
          <Text style={styles.logoSub}>
            {welcomeName ? `Welcome back, ${welcomeName.split(/\s+/)[0]}` : "Trainer app"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{welcomeName ? "Welcome back" : "Sign in"}</Text>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <Btn
            label={loading ? "Signing in..." : "Sign in"}
            onPress={handleSignIn}
            loading={loading}
            fullWidth
          />
          <OAuthButtons />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("RoleSelect")} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            Don't have an account?{" "}
            <Text style={styles.switchLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.xl },
  logo: { alignItems: "center", gap: spacing.xs },
  logoText: { fontSize: 32, fontWeight: "800", color: colors.white },
  logoAccent: { color: colors.accent },
  logoSub: { fontSize: font.sm, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.base,
  },
  title: { fontSize: font.lg, fontWeight: "700", color: colors.white },
  switchBtn: { alignItems: "center" },
  switchText: { fontSize: font.sm, color: colors.muted },
  switchLink: { color: colors.accent, fontWeight: "600" },
});
