import SidebarLink from "./SidebarLink";
import UsersLinkDropdown from "./UsersLinkDropdown";
import SugboGoText from "@/shared/components/SugboGoText";
import { useLogout } from "@/features/auth/hooks/useLogout";
import {
  FiBarChart2,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiShield,
  FiTag,
  FiUser,
} from "react-icons/fi";
import { logout } from "@/features/auth/utils/authSession";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import navigation from "../config/sidebarNavigation";

/**
 * Persistent left sidebar navigation for the super admin console.
 * Includes site logo, primary navigation links, nested user dropdown, and a logout action.
 *
 * @component
 * @param {function} onLogout - Callback event handler invoked when the logout button is pressed.
 * @param {boolean} isOpen - Controls whether the mobile sidebar overlay and panel are visible.
 * @param {function} onClose - Callback event handler invoked to close the mobile sidebar overlay or panel.
 */
export default function Sidebar({ onLogout, isOpen, onClose }) {
  const { handleLogout } = useLogout();

  const user = useAuthStore((state) => state.user);

  const visibleNavigation = navigation.filter((item) =>
    item.roles.includes(user.role),
  );
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-64 flex-col overflow-y-auto
          border-r border-stroke bg-background-primary
          transition-transform duration-300 ease-in-out

          ${isOpen ? "translate-x-0" : "-translate-x-full"}

          lg:translate-x-0
        `}
      >
        <div className="px-6 pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-extrabold leading-none">
              <SugboGoText includeLogo />
            </p>

            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
              SUPER ADMIN CONSOLE
            </p>
          </div>
        </div>

        <nav className="flex-1  px-4 py-6">
          <SidebarLink
            to="/admin-panel/dashboard"
            label="Dashboard"
            Icon={FiGrid}
            onClick={onClose}
          />

          <SidebarLink
            to="/admin-panel/msmes"
            label="MSMEs"
            Icon={FiShield}
            onClick={onClose}
          />

          <UsersLinkDropdown />

          {visibleNavigation.map((item) => (
            <SidebarLink key={item.to} {...item} onClick={onClose} />
          ))}
        </nav>

        <div className="border-t border-stroke px-4 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium text-red-500 transition duration-200 hover:bg-red-50"
          >
            <FiLogOut className="h-5 w-5 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
