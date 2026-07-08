import { useSSO } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { clerkErrorMessage } from "../lib/clerkError";
import { colors, font, radius, spacing } from "../theme";

// Dismisses the in-app browser and resolves the pending auth session once Clerk
// redirects back to the app. Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

type Strategy = "oauth_google" | "oauth_apple";

/**
 * Google / Apple sign-in buttons shared by the Sign In and Sign Up screens.
 * The same OAuth flow both creates a new account and signs an existing one in,
 * so on the Sign Up screen it inherits whatever role the user picked (the
 * post-auth router reads SignupRole to provision a client when appropriate).
 *
 * REQUIRES the matching social connections to be enabled in the Clerk dashboard
 * (Google works out of the box on dev instances; Apple needs an Apple Developer
 * Services ID + key and a native dev build to sign in natively).
 */
export default function OAuthButtons() {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState<Strategy | null>(null);

  // Android warm-up: pre-loads the browser so the OAuth tab opens instantly.
  useEffect(() => {
    if (Platform.OS === "android") void WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS === "android") void WebBrowser.coolDownAsync();
    };
  }, []);

  const onPress = useCallback(
    async (strategy: Strategy) => {
      if (busy) return;
      setBusy(strategy);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        // A completed flow hands back a session; anything else (user cancelled,
        // or extra verification needed) just leaves them on the auth screen.
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch (err) {
        Alert.alert("Sign in failed", clerkErrorMessage(err, "Couldn't continue — please try again."));
      } finally {
        setBusy(null);
      }
    },
    [busy, startSSOFlow]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => onPress("oauth_google")}
        disabled={!!busy}
        activeOpacity={0.8}
      >
        {busy === "oauth_google" ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <MaterialCommunityIcons name="google" size={18} color={colors.white} />
            <Text style={styles.btnText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onPress("oauth_apple")}
          disabled={!!busy}
          activeOpacity={0.8}
        >
          {busy === "oauth_apple" ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="apple" size={20} color={colors.white} />
              <Text style={styles.btnText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: font.xs, color: colors.muted },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  btnText: { fontSize: font.base, fontWeight: "600", color: colors.white },
});
