import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/admin-panel/Sidebar'

export default function AdminPanelLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    navigate('/admin-panel/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar onLogout={handleLogout} />

      <div className="ml-64 min-h-screen">
        <main className="min-h-screen overflow-y-auto p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}