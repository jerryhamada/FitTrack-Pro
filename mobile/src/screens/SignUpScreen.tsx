import { useSignUp } from "@clerk/clerk-expo";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import { parseSignupCode, usePendingInvite } from "../contexts/PendingInvite";
import { useSignupRole } from "../contexts/SignupRole";
import { api } from "../lib/api";
import { clerkErrorMessage } from "../lib/clerkError";
import { setWelcomeName } from "../lib/welcomeName";
import type { AuthStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AuthStackParamList, "SignUp">>();
  const { signUp, setActive, isLoaded } = useSignUp();
  const {
    token: inviteToken,
    setToken: setInviteToken,
    clearToken,
    joinCode,
    setJoinCode,
    clearJoinCode,
  } = usePendingInvite();
  const { role: chosenRole } = useSignupRole();
  // An invite or a trainer join code always means a client account; otherwise the
  // Role Selection choice decides (defaulting to trainer for logins that skipped
  // it, e.g. deep links).
  const role =
    inviteToken || joinCode ? "client" : route.params?.role ?? chosenRole ?? "trainer";
  const [fullName, setFullName] = useState("");
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

  // Same up-front validation for a trainer join code: a typo'd code fails here
  // with the trainer lookup, not after the account is created.
  const { data: joinPreview, error: joinError } = useQuery({
    queryKey: ["join-code-preview", joinCode],
    queryFn: () => api.clientPortal.joinCodePreview(joinCode!),
    enabled: joinCode !== null,
    retry: false,
    staleTime: Infinity,
  });

  // Prefill + lock the email from the invite so the client signs up with the
  // address their trainer used to invite them. Locked only while the token is
  // valid and carried an email; otherwise the field stays editable.
  const lockedEmail = inviteToken !== null && !inviteError ? invitePreview?.client_email ?? null : null;
  const emailLocked = lockedEmail !== null;

  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  function handleInviteSubmit() {
    const parsed = parseSignupCode(inviteInput);
    if (!parsed) {
      Alert.alert(
        "Invalid invite or code",
        "That doesn't look like an invite link or a trainer code — check it and try again."
      );
      return;
    }
    if (parsed.kind === "invite") setInviteToken(parsed.token);
    else setJoinCode(parsed.code);
    setInviteInputOpen(false);
    setInviteInput("");
  }

  async function handleSignUp() {
    if (!isLoaded) return;
    if (role === "trainer" && !fullName.trim()) {
      Alert.alert("Name required", "Enter your name — it's how clients find and recognize you.");
      return;
    }
    setLoading(true);
    try {
      // Clerk stores first/last separately; the backend mirrors the combined
      // `name` claim from the session JWT into users.name on first sign-in.
      const [firstName, ...rest] = fullName.trim().split(/\s+/);
      await signUp.create({
        emailAddress: email,
        password,
        ...(firstName ? { firstName, lastName: rest.join(" ") || undefined } : {}),
      });
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
        await setWelcomeName(fullName); // remembered for the sign-in greeting
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
            {role === "client" ? "Create your client account" : "Create your trainer account"}
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

        {joinCode && !inviteToken && (
          <View style={[styles.inviteBanner, !!joinError && styles.inviteBannerError]}>
            {joinError ? (
              <>
                <Text style={styles.inviteBannerError_text}>
                  {(joinError as Error).message || "That code doesn't match any trainer."}
                </Text>
                <TouchableOpacity onPress={clearJoinCode}>
                  <Text style={styles.inviteBannerDismiss}>Remove the code and try another</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.inviteBannerText}>
                  {joinPreview
                    ? `You'll join ${joinPreview.trainer_name ?? "your trainer"}${
                        joinPreview.trainer_business ? ` (${joinPreview.trainer_business})` : ""
                      } as a client.`
                    : `Checking code ${joinCode}...`}
                </Text>
                <TouchableOpacity onPress={clearJoinCode}>
                  <Text style={styles.inviteBannerDismiss}>Remove code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={styles.card}>
          {stage === "form" ? (
            <>
              <Text style={styles.title}>Create account</Text>
              {role === "trainer" && (
                <Input
                  label="Your name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Alex Rivera"
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="name"
                />
              )}
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!emailLocked}
                style={emailLocked ? styles.lockedInput : undefined}
              />
              {emailLocked && (
                <Text style={styles.lockedHint}>
                  Your trainer invited this email — sign up with it to link your account.
                </Text>
              )}
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
              <OAuthButtons />
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

        {/* Fallback entry for clients whose invite link didn't open the app, or
            who only have their trainer's short join code */}
        {!inviteToken &&
          !joinCode &&
          (inviteInputOpen ? (
            <View style={styles.inviteEntry}>
              <Input
                label="Invite link or trainer code"
                value={inviteInput}
                onChangeText={setInviteInput}
                placeholder="Invite link or code like AB2CD4"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Btn label="Use it" onPress={handleInviteSubmit} fullWidth />
            </View>
          ) : (
            <TouchableOpacity onPress={() => setInviteInputOpen(true)} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                Joining as a client?{" "}
                <Text style={styles.switchLink}>Enter your invite link or trainer code</Text>
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
  lockedInput: { color: colors.muted, opacity: 0.8 },
  lockedHint: { fontSize: font.xs, color: colors.muted, marginTop: -spacing.xs },
});
