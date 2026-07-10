import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Remembers which role the user picked on the Role Selection screen so the
 * post-auth router knows what to do with a brand-new login: "client" means
 * provision a standalone client account and run the Find Your Trainer step.
 * Invite-link signups bypass this entirely (PendingInvite wins).
 *
 * PERSISTED to AsyncStorage: the choice must survive app restarts and dev
 * reloads. Losing it between signup and provisioning used to drop new client
 * logins into the trainer app, whose first API call permanently provisioned
 * them as trainers. The router now waits for `hydrated` before making any
 * role-null decision, and never defaults an undecided login to trainer.
 */

type SignupRole = "trainer" | "client";

const STORAGE_KEY = "fittrack:signup-role";

interface SignupRoleState {
  role: SignupRole | null;
  /** False until the persisted choice has been read — don't route role-null logins before this. */
  hydrated: boolean;
  setRole: (role: SignupRole) => void;
  clearRole: () => void;
}

const SignupRoleContext = createContext<SignupRoleState>({
  role: null,
  hydrated: false,
  setRole: () => {},
  clearRole: () => {},
});

export function SignupRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<SignupRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "trainer" || v === "client") setRoleState(v);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const setRole = useCallback((r: SignupRole) => {
    setRoleState(r);
    AsyncStorage.setItem(STORAGE_KEY, r).catch(() => {});
  }, []);
  const clearRole = useCallback(() => {
    setRoleState(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <SignupRoleContext.Provider value={{ role, hydrated, setRole, clearRole }}>
      {children}
    </SignupRoleContext.Provider>
  );
}

export function useSignupRole(): SignupRoleState {
  return useContext(SignupRoleContext);
}
