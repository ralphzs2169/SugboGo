import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FiChevronDown, FiShield, FiUsers } from "react-icons/fi";
import { linkBase } from "./SidebarLink";
import SidebarLink from "./SidebarLink";

/**
 * UsersLinkDropdown component renders a collapsible dropdown menu for the "Users" section
 * in the admin panel sidebar. It automatically expands when the current route matches
 * the "Users" section and allows manual toggling of the dropdown state.
 *
 */

function UsersLinkDropdown() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(
    location.pathname.startsWith("/admin-panel/users"),
  );
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);

  useEffect(() => {
    if (
      location.pathname.startsWith("/admin-panel/users") &&
      !isManuallyCollapsed
    ) {
      setIsOpen(true);
    }

    if (!location.pathname.startsWith("/admin-panel/users")) {
      setIsManuallyCollapsed(false);
    }
  }, [location.pathname, isManuallyCollapsed]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => {
            const nextIsOpen = !current;

            return nextIsOpen;
          });
          setIsManuallyCollapsed(false);
        }}
        className={`${linkBase} w-full justify-between text-text-primary hover:bg-interaction-hover`}
        aria-expanded={isOpen}
        aria-label="Toggle Users submenu"
      >
        <span className="flex min-w-0 items-center gap-3 rounded-lg">
          <FiUsers className="h-5 w-5 shrink-0" />
          <span className="truncate">Users</span>
        </span>

        <FiChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="mt-2 border-l border-stroke-strong ml-6">
          <SidebarLink
            to="/admin-panel/users/all"
            label="All Users"
            Icon={FiUsers}
          />
          <SidebarLink
            to="/admin-panel/users/roles-permissions"
            label="Roles & Permissions"
            Icon={FiShield}
          />
        </div>
      ) : null}
    </div>
  );
}

export default UsersLinkDropdown;
