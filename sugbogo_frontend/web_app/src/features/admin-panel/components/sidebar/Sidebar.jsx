import { useEffect } from "react";

import useMediaQuery from "@/shared/hooks/useMediaQuery";

import SidebarLogo from "./SidebarLogo";
import SidebarCollapseButton from "./SidebarCollapseButton";
import SidebarMenu from "./SidebarMenu";
import SidebarFooter from "./SidebarFooter";
import SidebarOverlay from "./SidebarOverlay";

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";

/**
 * Primary sidebar for the admin panel.
 *
 * Supports:
 * - Responsive mobile drawer.
 * - Persistent collapsed state on desktop.
 * - Scrollable navigation with fixed header and footer.
 *
 * @component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the mobile sidebar is open.
 * @param {Function} props.onClose - Closes the mobile sidebar.
 * @param {boolean} props.isCollapsed - Whether the desktop sidebar is collapsed.
 * @param {Function} props.onToggleCollapse - Toggles the desktop collapsed state.
 *
 * @returns {JSX.Element}
 */
export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // The sidebar is only collapsible on desktop.
  const collapsed = isDesktop && isCollapsed;

  function toggleCollapsed() {
    const next = !isCollapsed;

    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));

    onToggleCollapse();
  }

  // Prevent the page from scrolling while the mobile sidebar is open.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <SidebarOverlay isOpen={isOpen} onClose={onClose} />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen flex-col
          overflow-visible
          border-r border-stroke
          bg-background
          transition-[width,transform] duration-300
          ${collapsed ? "lg:w-20" : "lg:w-62"}
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Sidebar header */}
        <div className="relative border-b border-stroke pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-shrink-0">
              <SidebarLogo isCollapsed={collapsed} />
            </div>

            <SidebarCollapseButton
              isCollapsed={collapsed}
              onToggle={toggleCollapsed}
            />
          </div>
        </div>

        {/* Scrollable navigation */}
        <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto">
          <SidebarMenu isCollapsed={collapsed} onClose={onClose} />
        </div>

        {/* Fixed footer */}
        <SidebarFooter isCollapsed={collapsed} />
      </aside>
    </>
  );
}
