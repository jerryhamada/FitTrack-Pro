import { createContext, useContext } from "react";

// The client whose portal data the client-facing screens should load. In a real
// client login this stays undefined — the backend derives the client from the
// auth token. In the dev-only "preview as client" mode, ClientPreviewScreen
// resolves a specific client (Ava Burkley by default) and provides their id here
// so every portal screen shows that client's real data.
const PreviewClientContext = createContext<number | undefined>(undefined);

export const PreviewClientProvider = PreviewClientContext.Provider;

export function usePreviewClientId(): number | undefined {
  return useContext(PreviewClientContext);
}
