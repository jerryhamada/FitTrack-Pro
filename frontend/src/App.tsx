import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, RedirectToSignIn } from "@clerk/react";
import { ApiError, setTokenGetter } from "./lib/api";
import { showToast } from "./lib/toast";
import NavShell from "./components/layout/NavShell";
import ToastHost from "./components/ui/ToastHost";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import AddClientPage from "./pages/AddClientPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ExerciseLibraryPage from "./pages/ExerciseLibraryPage";
import ProgramsListPage from "./pages/ProgramsListPage";
import ProgramBuilderPage from "./pages/ProgramBuilderPage";
import SessionLogPage from "./pages/SessionLogPage";
import SessionSummaryPage from "./pages/SessionSummaryPage";
import ActivityPage from "./pages/ActivityPage";
import SettingsPage from "./pages/SettingsPage";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Pages that render their own inline error UI (e.g. the live session log,
      // where losing context on a failed set matters most) opt out via meta.
      if (mutation.meta?.skipGlobalToast) return;
      showToast(error instanceof ApiError ? error.message : "Something went wrong — please try again.");
    },
  }),
});

function AuthSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <>{children}</>;
}

function AppShell() {
  return (
    <NavShell>
      <ToastHost />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients/new" element={<AddClientPage />} />
        <Route path="/clients/:clientId/*" element={<ClientProfilePage />} />
        <Route path="/exercises" element={<ExerciseLibraryPage />} />
        <Route path="/programs" element={<ProgramsListPage />} />
        <Route path="/programs/new" element={<ProgramBuilderPage />} />
        <Route path="/programs/:programId/edit" element={<ProgramBuilderPage />} />
        <Route path="/sessions/:sessionId" element={<SessionLogPage />} />
        <Route path="/sessions/:sessionId/summary" element={<SessionSummaryPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NavShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthSync />
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
