import { Navigate, Route, Routes } from 'react-router-dom';
import AdminPanelLayout from './pages/AdminPanel/AdminPanelLayout';
import Dashboard from './pages/AdminPanel/Dashboard';
import Msmes from './pages/AdminPanel/Msmes';
import Users from './pages/AdminPanel/Users';
import ExplorerActivities from './pages/AdminPanel/ExplorerActivities';
import SpecialtyTags from './pages/AdminPanel/SpecialtyTags';
import SuspiciousActivities from './pages/AdminPanel/SuspiciousActivities';
import Analytics from './pages/AdminPanel/Analytics';
import Settings from './pages/AdminPanel/Settings';
import RolesPermissions from './pages/AdminPanel/RolesPermissions';

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
    </Routes>
  )
}

export default App
