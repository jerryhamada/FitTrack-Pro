import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { NavigationContainer } from "@react-navigation/native";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
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
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
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
