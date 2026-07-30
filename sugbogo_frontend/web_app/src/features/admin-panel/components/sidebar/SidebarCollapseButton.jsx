import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import Tooltip from "@/shared/components/actions/Tooltip";

/**
 * Toggle button for collapsing and expanding the desktop sidebar.
 *
 * The button is positioned on the boundary between the sidebar header
 * and the main content to provide an easily discoverable affordance
 * without competing with the branding.
 *
 * Hidden on mobile, where the sidebar is presented as a drawer.
 *
 * @component
 *
 * @param {Object} props
 * @param {boolean} props.isCollapsed - Whether the sidebar is currently collapsed.
 * @param {function} props.onToggle - Toggles the sidebar collapsed state.
 *
 * @returns {JSX.Element}
 */
export default function SidebarCollapseButton({ isCollapsed, onToggle }) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!isCollapsed}
      className="
        absolute right-0 bottom-0
        hidden h-8 w-8
        translate-x-1/2 translate-y-1/2
        cursor-pointer
        items-center justify-center
        rounded-full
        border border-stroke
        bg-background
        text-text-secondary
        shadow-sm
        transition-all
        hover:bg-surface-muted
        hover:text-text-primary
        lg:flex
      "
    >
      {isCollapsed ? (
        <FiChevronRight className="h-4 w-4" />
      ) : (
        <FiChevronLeft className="h-4 w-4" />
      )}
    </button>
  );

  return (
    <Tooltip
      content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      place="right"
      asChild
    >
      {button}
    </Tooltip>
  );
}
