// Build-environment helpers.
//
// APP_ENV resolution order:
//   1. EXPO_PUBLIC_APP_ENV (inlined at bundle time — set to "staging" for staging builds)
//   2. __DEV__ fallback: dev bundles -> "development", release bundles -> "production"
//
// Fails safe: a release build that forgets to set the env var resolves to
// "production" and every dev-only affordance is excluded from the render tree.
export const APP_ENV: string =
  process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? "development" : "production");

export const IS_DEV_BUILD = APP_ENV !== "production";
