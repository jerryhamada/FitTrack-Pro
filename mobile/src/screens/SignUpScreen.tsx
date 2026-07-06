import { useSignUp } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import { parseInviteToken, usePendingInvite } from "../contexts/PendingInvite";
import { api } from "../lib/api";
import { clerkErrorMessage } from "../lib/clerkError";
import type { AuthStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { token: inviteToken, setToken: setInviteToken, clearToken } = usePendingInvite();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [inviteInputOpen, setInviteInputOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");

  // "You've been invited by <trainer>" — also validates the token up front so a
  // dead link fails here, not after the account is created.
  const { data: invitePreview, error: inviteError } = useQuery({
    queryKey: ["invite-preview", inviteToken],
    queryFn: () => api.clientPortal.invitePreview(inviteToken!),
    enabled: inviteToken !== null,
    retry: false,
    staleTime: Infinity,
  });

  function handleInviteSubmit() {
    const parsed = parseInviteToken(inviteInput);
    if (!parsed) {
      Alert.alert("Invalid invite", "That doesn't look like an invite link or code — check it and try again.");
      return;
    }
    setInviteToken(parsed);
    setInviteInputOpen(false);
    setInviteInput("");
  }

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
          <Text style={styles.logoSub}>
            {inviteToken ? "Create your client account" : "Create your trainer account"}
          </Text>
        </View>

        {inviteToken && (
          <View style={[styles.inviteBanner, !!inviteError && styles.inviteBannerError]}>
            {inviteError ? (
              <>
                <Text style={styles.inviteBannerError_text}>
                  {(inviteError as Error).message || "This invite link isn't valid."}
                </Text>
                <TouchableOpacity onPress={clearToken}>
                  <Text style={styles.inviteBannerDismiss}>Continue as a trainer instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.inviteBannerText}>
                {invitePreview
                  ? `${invitePreview.trainer_name ?? "Your trainer"} invited you (${invitePreview.client_name}) to join.`
                  : "Checking your invite..."}
              </Text>
            )}
          </View>
        )}

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

        {/* Fallback entry for clients whose invite link didn't open the app */}
        {!inviteToken &&
          (inviteInputOpen ? (
            <View style={styles.inviteEntry}>
              <Input
                label="Invite link or code"
                value={inviteInput}
                onChangeText={setInviteInput}
                placeholder="Paste your invite link here"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Btn label="Use invite" onPress={handleInviteSubmit} fullWidth />
            </View>
          ) : (
            <TouchableOpacity onPress={() => setInviteInputOpen(true)} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                Joining as a client? <Text style={styles.switchLink}>Enter your invite link</Text>
              </Text>
            </TouchableOpacity>
          ))}
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
  inviteBanner: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  inviteBannerError: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.4)",
  },
  inviteBannerText: { fontSize: font.sm, color: colors.accent, textAlign: "center", fontWeight: "600" },
  inviteBannerError_text: { fontSize: font.sm, color: colors.danger, textAlign: "center" },
  inviteBannerDismiss: {
    fontSize: font.xs,
    color: colors.muted,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  inviteEntry: { gap: spacing.sm },
});
