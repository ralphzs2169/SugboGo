import { FiGrid } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuthStore } from "@/features/auth/storage/auth.store";

import navigation from "../../config/sidebarNavigation";
import useBusinessApplicationStatistics from "../../business-applications/hooks/useBusinessApplicationStatistics";
import SidebarLink from "./SidebarLink";
import SidebarDropdown from "./SidebarDropdown";
import SidebarSectionHeading from "./SidebarSectionHeading";

/**
 * Renders the primary navigation for the admin sidebar.
 *
 * Navigation is driven entirely by the sidebar configuration and
 * filtered according to the authenticated user's role.
 *
 * Behavior:
 * - Expanded sidebar: multiple dropdown groups may remain open.
 * - Collapsed sidebar: flyout menus behave like an accordion.
 */
export default function SidebarMenu({ onClose, isCollapsed, showLabels }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  const [openFlyout, setOpenFlyout] = useState(null);

  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const { statistics: applicationStatistics } =
    useBusinessApplicationStatistics();

  // Close any flyout when switching into collapsed mode.
  useEffect(() => {
    if (isCollapsed) {
      setOpenFlyout(null);
    }
  }, [isCollapsed]);

  // Filter the navigation configuration to only include
  // sections and items accessible to the current user's role.
  const accessibleSections = useMemo(
    () =>
      navigation
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.roles.includes(user.role)),
        }))
        .filter((section) => section.items.length > 0),
    [user.role],
  );

  function toggleFlyout(label) {
    setOpenFlyout((current) => (current === label ? null : label));
  }

  /**
   * Toggles a dropdown group in expanded mode.
   * Multiple groups may remain expanded simultaneously.
   */
  function toggleExpandedGroup(label) {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  }

  function handleFlyoutItemClick() {
    setOpenFlyout(null);
    onClose?.();
  }

  return (
    <nav className="flex-1 px-4 py-6">
      <SidebarLink
        to="/admin-panel/dashboard"
        label="Dashboard"
        Icon={FiGrid}
        onClick={onClose}
        isCollapsed={isCollapsed}
        showLabels={showLabels}
      />

      {accessibleSections.map((section) => (
        <div key={section.section}>
          {!isCollapsed && <SidebarSectionHeading title={section.section} />}

          {section.items.map((item) =>
            item.type === "group" ? (
              <SidebarDropdown
                key={item.label}
                {...item}
                onClick={isCollapsed ? handleFlyoutItemClick : onClose}
                isCollapsed={isCollapsed}
                isOpen={
                  isCollapsed
                    ? openFlyout === item.label
                    : expandedGroups.has(item.label)
                }
                onToggle={() =>
                  isCollapsed
                    ? toggleFlyout(item.label)
                    : toggleExpandedGroup(item.label)
                }
                hasActiveChild={item.children.some((child) =>
                  location.pathname.startsWith(child.to),
                )}
                showLabels={showLabels}
              />
            ) : (
              <SidebarLink
                key={item.to}
                {...item}
                badge={
                  item.to === "/admin-panel/businesses/applications"
                    ? applicationStatistics.pending_review
                    : undefined
                }
                onClick={onClose}
                isCollapsed={isCollapsed}
                showLabels={showLabels}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}
