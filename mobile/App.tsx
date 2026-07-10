import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { NavigationContainer } from "@react-navigation/native";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PendingInviteProvider } from "./src/contexts/PendingInvite";
import { RoleOverrideProvider } from "./src/contexts/RoleOverride";
import { SignupRoleProvider } from "./src/contexts/SignupRole";
import { setTokenGetter, ApiError } from "./src/lib/api";
import RootNavigator from "./src/navigation";
import { colors } from "./src/theme";

const PUBLISHABLE_KEY = "pk_test_YW11c2luZy1maXNoLTg4LmNsZXJrLmFjY291bnRzLmRldiQ";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if ((mutation.meta as { skipGlobalToast?: boolean } | null)?.skipGlobalToast) return;
      const msg = error instanceof ApiError ? error.message : "Something went wrong — please try again.";
      Alert.alert("Error", msg);
    },
  }),
});

const NAV_THEME = {
  dark: true,
  colors: {
    background: colors.bg,
    card: colors.surface,
    text: colors.white,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" as const },
    medium: { fontFamily: "System", fontWeight: "500" as const },
    bold: { fontFamily: "System", fontWeight: "700" as const },
    heavy: { fontFamily: "System", fontWeight: "900" as const },
  },
};

function AuthSync() {
  const { getToken, userId } = useAuth();
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  // Drop ALL cached server state whenever the signed-in identity changes
  // (sign-out or a different login). Queries like whoami cache with
  // staleTime: Infinity, so without this a fresh client signup would read the
  // previous account's cached role, render the trainer app, and get
  // auto-provisioned as a trainer by its first API call.
  useEffect(() => {
    const prev = prevUserId.current;
    prevUserId.current = userId ?? null;
    if (prev !== undefined && prev !== (userId ?? null)) qc.clear();
  }, [userId]);

  return null;
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={qc}>
          <SafeAreaProvider>
            <RoleOverrideProvider>
              <PendingInviteProvider>
              <SignupRoleProvider>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
                <NavigationContainer theme={NAV_THEME}>
                  <AuthSync />
                  <RootNavigator />
                </NavigationContainer>
              </SignupRoleProvider>
              </PendingInviteProvider>
            </RoleOverrideProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
