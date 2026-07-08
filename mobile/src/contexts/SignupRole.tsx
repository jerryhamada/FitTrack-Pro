import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Remembers which role the user picked on the Role Selection screen so the
 * post-auth router knows what to do with a brand-new login: "client" means
 * provision a standalone client account and run the Find Your Trainer step.
 * Invite-link signups bypass this entirely (PendingInvite wins), and trainer
 * signups need no marker — an unprovisioned login already defaults to the
 * trainer app.
 */

type SignupRole = "trainer" | "client";

interface SignupRoleState {
  role: SignupRole | null;
  setRole: (role: SignupRole) => void;
  clearRole: () => void;
}

const SignupRoleContext = createContext<SignupRoleState>({
  role: null,
  setRole: () => {},
  clearRole: () => {},
});

export function SignupRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<SignupRole | null>(null);
  const setRole = useCallback((r: SignupRole) => setRoleState(r), []);
  const clearRole = useCallback(() => setRoleState(null), []);
  return (
    <SignupRoleContext.Provider value={{ role, setRole, clearRole }}>
      {children}
    </SignupRoleContext.Provider>
  );
}

export function useSignupRole(): SignupRoleState {
  return useContext(SignupRoleContext);
}
