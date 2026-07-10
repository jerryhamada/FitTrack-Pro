import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Linking } from "react-native";

/**
 * Holds a client-invite token captured before/while the user authenticates, so
 * the signup flow knows this login should become a CLIENT account and the
 * navigator knows to redeem the invite right after sign-in/sign-up.
 *
 * Tokens arrive via deep link (liftiq://invite/<token>, or the shared https
 * invite URL once universal links are configured) or manual paste on the
 * signup screen.
 */

// token_urlsafe(24) server-side — url-safe base64, no padding.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
// Trainer join code: 6 chars today (see backend JOIN_CODE_LENGTH), accept 4-10
// alphanumerics so the shape can evolve. Length ranges keep the two disjoint
// from invite tokens (16+), so one input field can accept either.
const JOIN_CODE_RE = /^[A-Za-z0-9]{4,10}$/;

export function parseInviteToken(input: string): string | null {
  const raw = input.trim();
  if (TOKEN_RE.test(raw)) return raw;
  // Landing-page URL: .../invite.html?t=<token> (what the shared link looks like).
  const query = raw.match(/[?&]t=([A-Za-z0-9_-]+)/);
  if (query && TOKEN_RE.test(query[1])) return query[1];
  // Any URL with an invite/<token> path segment: the liftiq://invite/<token>
  // deep link and Expo Go dev URLs (exp://host/--/invite/<token>).
  const match = raw.match(/invite\/([A-Za-z0-9_-]+)/);
  if (match && TOKEN_RE.test(match[1])) return match[1];
  return null;
}

/** Classify whatever the user pasted on the signup screen: an invite link/token
 * or a short trainer join code. Both mean "this login becomes a client". */
export function parseSignupCode(
  input: string
): { kind: "invite"; token: string } | { kind: "join"; code: string } | null {
  const token = parseInviteToken(input);
  if (token) return { kind: "invite", token };
  const raw = input.trim();
  if (JOIN_CODE_RE.test(raw)) return { kind: "join", code: raw.toUpperCase() };
  return null;
}

interface PendingInviteState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  /** Trainer join code captured at signup, redeemed right after auth. */
  joinCode: string | null;
  setJoinCode: (code: string) => void;
  clearJoinCode: () => void;
}

const PendingInviteContext = createContext<PendingInviteState>({
  token: null,
  setToken: () => {},
  clearToken: () => {},
  joinCode: null,
  setJoinCode: () => {},
  clearJoinCode: () => {},
});

export function PendingInviteProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [joinCode, setJoinCodeState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      const parsed = parseInviteToken(url);
      if (parsed) setTokenState(parsed);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      const parsed = parseInviteToken(url);
      if (parsed) setTokenState(parsed);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const setToken = useCallback((t: string) => setTokenState(t), []);
  const clearToken = useCallback(() => setTokenState(null), []);
  const setJoinCode = useCallback((c: string) => setJoinCodeState(c.trim().toUpperCase()), []);
  const clearJoinCode = useCallback(() => setJoinCodeState(null), []);

  return (
    <PendingInviteContext.Provider
      value={{ token, setToken, clearToken, joinCode, setJoinCode, clearJoinCode }}
    >
      {children}
    </PendingInviteContext.Provider>
  );
}

export function usePendingInvite(): PendingInviteState {
  return useContext(PendingInviteContext);
}
