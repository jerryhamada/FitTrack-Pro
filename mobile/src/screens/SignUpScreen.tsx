import { useSignUp } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
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
import { clerkErrorMessage } from "../lib/clerkError";
import type { AuthStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (err: unknown) {
      Alert.alert("Error", clerkErrorMessage(err, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      } else {
        Alert.alert("Verification failed", "Check the code and try again.");
      }
    } catch (err: unknown) {
      Alert.alert("Error", clerkErrorMessage(err, "Verification failed"));
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
          <Text style={styles.logoSub}>Create your trainer account</Text>
        </View>

        <View style={styles.card}>
          {stage === "form" ? (
            <>
              <Text style={styles.title}>Create account</Text>
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
                label={loading ? "Creating account..." : "Create account"}
                onPress={handleSignUp}
                loading={loading}
                fullWidth
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.verifyHint}>
                We sent a code to {email}. Enter it below.
              </Text>
              <Input
                label="Verification code"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              <Btn
                label={loading ? "Verifying..." : "Verify & sign in"}
                onPress={handleVerify}
                loading={loading}
                fullWidth
              />
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("SignIn")} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            Already have an account?{" "}
            <Text style={styles.switchLink}>Sign in</Text>
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
  verifyHint: { fontSize: font.sm, color: colors.muted },
  switchBtn: { alignItems: "center" },
  switchText: { fontSize: font.sm, color: colors.muted },
  switchLink: { color: colors.accent, fontWeight: "600" },
});
