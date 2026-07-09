import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from '../../components/admin-panel/Sidebar'
import Header from '../../components/admin-panel/Header'
import { PAGE_METADATA } from '../../constants/pageMetadata'

export default function AdminPanelLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const page = PAGE_METADATA[location.pathname] ?? {
    title: 'SugboGo Admin',
    subtitle: '',
  }

  const handleLogout = () => {
    navigate('/admin-panel/dashboard')
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      <Sidebar
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-h-screen lg:ml-64">
        <section className="sticky top-0 z-50 border-b border-stroke bg-background-primary">
          <Header
            title={page.title}
            subtitle={page.subtitle}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        </section>
        <main className=" p-6 sm:p-8 "> 
          <Outlet />
        </main>
      </div>
    </div>
  )
}