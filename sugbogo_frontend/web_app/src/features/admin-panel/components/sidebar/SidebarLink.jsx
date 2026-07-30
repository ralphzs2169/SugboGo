import { NavLink } from "react-router-dom";
import Tooltip from "@/shared/components/actions/Tooltip";

// Base styles for the sidebar link, shared between expanded and collapsed states.
export const linkBase =
  "flex items-center rounded-lg text-[12px] font-medium transition";

/**
 * Renders a single navigation link within the admin sidebar.
 *
 * Supports both:
 * - Expanded sidebar with icon and label.
 * - Collapsed sidebar with icon-only navigation and tooltip.
 *
 * @component
 *
 * @param {Object} props
 * @param {string} props.to - Route the link navigates to.
 * @param {string} props.label - Display label for the navigation item.
 * @param {React.ComponentType} props.Icon - Icon displayed alongside the label.
 * @param {function} props.onClick - Invoked after selecting the link.
 * @param {boolean} [props.isCollapsed=false] - Whether the sidebar is collapsed.
 *
 * @returns {JSX.Element}
 */
export default function SidebarLink({
  to,
  label,
  Icon,
  onClick,
  isCollapsed = false,
}) {
  const link = (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `
      ${linkBase}
      ${isCollapsed ? "h-10 w-10 justify-center" : "w-full gap-3 px-2 py-3"}
      ${
        isActive
          ? "bg-primary text-white"
          : "text-text-primary hover:bg-interaction-hover"
      }
      `
      }
    >
      <Icon className="h-5 w-5 shrink-0" />

      <span
        className={` truncate overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"} `}
      >
        {label}
      </span>
    </NavLink>
  );

  return isCollapsed ? (
    <Tooltip content={label} place="right" asChild>
      {link}
    </Tooltip>
  ) : (
    link
  );
}
