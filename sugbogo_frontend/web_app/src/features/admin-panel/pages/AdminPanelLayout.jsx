import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "@/features/admin-panel/components/sidebar/Sidebar";
import NavigationHeader from "@/features/admin-panel/components/NavigationHeader";

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";

/**
 * AdminPanelLayout component that serves as the main layout for the admin panel.
 * It includes a sidebar, header, and an outlet for rendering child routes.
 */

export default function AdminPanelLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate("/admin-panel/dashboard");
  };

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div
        className={`
    min-h-screen
    transition-[margin] duration-300
    ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-62"}
  `}
      >
        <section className="sticky top-0 z-20 border-b border-stroke bg-background">
          <NavigationHeader onMenuClick={() => setIsSidebarOpen(true)} />
        </section>
        <main className=" p-6 sm:p-4 ">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
