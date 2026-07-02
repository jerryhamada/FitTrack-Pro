// DEV ONLY: when true, the app skips the Clerk sign-in gate and loads straight
// into the trainer tabs. The backend must be running with DEV_AUTH_BYPASS=1 so
// unauthenticated API calls resolve to the dev trainer. Set back to false to
// restore the normal auth flow.
export const DEV_BYPASS_AUTH = true;
