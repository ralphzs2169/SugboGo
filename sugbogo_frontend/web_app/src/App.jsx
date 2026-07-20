import { Navigate, Route, Routes } from "react-router-dom";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/storage/auth.store";

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
import Login from "@/features/admin-panel/pages/Login";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";

function App() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
