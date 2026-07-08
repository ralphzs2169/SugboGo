import { Navigate, Route, Routes } from 'react-router-dom';
import AdminPanelLayout from './pages/admin-panel/AdminPanelLayout';
import Dashboard from './pages/admin-panel/Dashboard';
import Msmes from './pages/admin-panel/Msmes';
import Users from './pages/admin-panel/Users';
import ExplorerActivities from './pages/admin-panel/ExplorerActivities';
import SpecialtyTags from './pages/admin-panel/SpecialtyTags';
import SuspiciousActivities from './pages/admin-panel/SuspiciousActivities';
import Analytics from './pages/admin-panel/Analytics';
import Settings from './pages/admin-panel/Settings';
import RolesPermissions from './pages/admin-panel/RolesPermissions';
import Login from './pages/admin-panel/Login';

function App() {
  return (
    <Routes>
      <Route path="/admin-panel" element={<AdminPanelLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="msmes" element={<Msmes />} />
        <Route path="users" element={<Users />} />
        <Route path="users/all" element={<Users />} />
        <Route path="users/roles-permissions" element={<RolesPermissions />} />
        <Route path="explorer-activity" element={<ExplorerActivities />} />
        <Route path="specialty-tags" element={<SpecialtyTags />} />
        <Route path="flags-suspicious" element={<SuspiciousActivities />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
