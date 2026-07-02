import { createContext, useContext, useMemo, useState } from "react";
import { IS_DEV_BUILD } from "../lib/env";

// DEV ONLY: session-only role override for previewing the app as another role.
// Lives purely in memory — never persisted, never sent to the backend. Resets on
// logout (Settings calls clearOverride before signOut) and on app restart.

export type PreviewRole = "trainer" | "client";

interface RoleOverrideValue {
  override: PreviewRole | null;
  setOverride: (role: PreviewRole | null) => void;
  clearOverride: () => void;
}

const RoleOverrideContext = createContext<RoleOverrideValue>({
  override: null,
  setOverride: () => {},
  clearOverride: () => {},
});

export function RoleOverrideProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<PreviewRole | null>(null);

  const value = useMemo<RoleOverrideValue>(
    () =>
      IS_DEV_BUILD
        ? { override, setOverride, clearOverride: () => setOverride(null) }
        : { override: null, setOverride: () => {}, clearOverride: () => {} }, // inert in production
    [override]
  );

  return <RoleOverrideContext.Provider value={value}>{children}</RoleOverrideContext.Provider>;
}

export function useRoleOverride(): RoleOverrideValue {
  return useContext(RoleOverrideContext);
}
