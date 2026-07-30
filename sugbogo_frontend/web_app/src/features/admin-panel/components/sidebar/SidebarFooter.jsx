import { FiLogOut } from "react-icons/fi";
import { useLogout } from "@/features/auth/hooks/useLogout";

/**
 * Fixed footer displayed at the bottom of the sidebar.
 * Contains global actions that should always remain visible.
 *
 * @component
 *
 * @param {Object} props
 * @param {boolean} [props.isCollapsed=false] - Whether the sidebar is collapsed.
 *
 * @returns {JSX.Element}
 */
export default function SidebarFooter({ isCollapsed = false }) {
  const { handleLogout } = useLogout();

  return (
    <div className="border-t border-stroke px-4 py-4">
      <button
        type="button"
        onClick={handleLogout}
        className={`
          flex items-center rounded-lg
          text-sm font-medium text-red-500
          transition-colors hover:bg-red-50
          ${isCollapsed ? "h-10 w-10 justify-center" : "w-full gap-3 px-4 py-3"}
        `}
      >
        <FiLogOut className="h-5 w-5 shrink-0" />

        {/* Animate the label as the sidebar expands and collapses. */}
        <span
          className={`
            truncate overflow-hidden whitespace-nowrap
            transition-all duration-300
            ${isCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"}
          `}
        >
          Logout
        </span>
      </button>
    </div>
  );
}
