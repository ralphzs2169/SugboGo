import { Navigate, Route, Routes } from "react-router-dom";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import { Toaster } from "react-hot-toast";

import LoginPage from "@/features/auth/pages/LoginPage";

import AdminPanelLayout from "@/features/admin-panel/pages/AdminPanelLayout";
import Dashboard from "@/features/admin-panel/pages/Dashboard";
import Msmes from "@/features/admin-panel/pages/Msmes";
import Users from "@/features/admin-panel/pages/Users";
import ExplorerActivities from "@/features/admin-panel/pages/ExplorerActivities";
import SpecialtyTags from "@/features/admin-panel/pages/SpecialtyTags";
import SuspiciousActivities from "@/features/admin-panel/pages/SuspiciousActivities";
import Analytics from "@/features/admin-panel/pages/Analytics";
import Settings from "@/features/admin-panel/pages/Settings";
import RolesPermissions from "@/features/admin-panel/pages/RolesPermissions";
import ProtectedRoute from "@/features/auth/routes/ProtectedRoute";

import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import EmailSentPage from "@/features/auth/pages/EmailSentPage";
import NotFound from "@/shared/components/errors/NotFound";

import PageLoader from "@/shared/components/loading/PageLoader";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

function App() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);
  const showLoader = useDelayedLoading(isLoading, 300);

  if (showLoader) {
    return <PageLoader />;
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/forgot-password/sent" element={<EmailSentPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/admin-panel" element={<AdminPanelLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="msmes" element={<Msmes />} />
            <Route path="users" element={<Users />} />
            <Route path="users/all" element={<Users />} />
            <Route
              path="users/roles-permissions"
              element={<RolesPermissions />}
            />
            <Route path="explorer-activity" element={<ExplorerActivities />} />
            <Route path="specialty-tags" element={<SpecialtyTags />} />
            <Route path="flags-suspicious" element={<SuspiciousActivities />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
    </>
  );
}

export default App;
