import { IS_DEV_BUILD } from "./env";

// DEV ONLY: skips the Clerk sign-in gate and loads straight into the trainer
// tabs. The backend must be running with DEV_AUTH_BYPASS=1 so unauthenticated
// API calls resolve to the dev trainer. Tied to IS_DEV_BUILD so this can never
// be true in a production build (TestFlight, App Store) — only in local/Expo
// Go development and EAS "preview"/"development" profile builds.
export const DEV_BYPASS_AUTH = IS_DEV_BUILD;
