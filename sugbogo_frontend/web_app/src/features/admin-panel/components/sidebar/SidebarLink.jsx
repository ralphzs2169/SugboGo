import { NavLink, useLocation } from "react-router-dom";
import Tooltip from "@/shared/components/actions/Tooltip";

// Base styles for the sidebar link, shared between expanded and collapsed states.
export const linkBase =
  "flex rounded-sm items-center text-[11px] font-medium transition";

function isDynamicSegmentValue(value) {
  return /^\d+$/.test(value);
}

function matchesPath(pathname, path) {
  const pathnameSegments = pathname.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);

  if (pathnameSegments.length !== pathSegments.length) {
    return false;
  }

  return pathSegments.every((segment, index) =>
    segment.startsWith("[") && segment.endsWith("]")
      ? isDynamicSegmentValue(pathnameSegments[index])
      : segment === pathnameSegments[index],
  );
}

/**
 * Renders a single navigation link within the admin sidebar.
 *
 * Supports both:
 * - Expanded sidebar with icon and label.
 * - Collapsed sidebar with icon-only navigation and tooltip.
 */
export default function SidebarLink({
  to,
  label,
  Icon,
  onClick,
  badge,
  activePaths = [],
  isCollapsed = false,
}) {
  const location = useLocation();

  const paths = activePaths.length > 0 ? activePaths : [to];

  const isCustomActive = paths.some((path) =>
    matchesPath(location.pathname, path),
  );

  const link = (
    <NavLink
      to={to}
      onClick={onClick}
      className={`
        ${linkBase}
        relative
        ${isCollapsed ? "h-10 w-10 justify-center" : "w-full gap-3 px-2 py-3"}
        ${
          isCustomActive
            ? "bg-sidebar-active text-text-primary"
            : "text-text-primary hover:bg-interaction-hover"
        }
      `}
    >
      {isCustomActive && (
        <span className="absolute inset-y-0 left-0 w-1 rounded-l-full bg-primary" />
      )}

      <Icon className="h-4.5 w-4.5 shrink-0" />

      <span
        className={`truncate overflow-hidden whitespace-nowrap transition-all duration-300 ${
          isCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"
        }`}
      >
        {label}
      </span>

      {badge > 0 && (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold leading-none text-white ${
            isCollapsed
              ? "absolute -right-1 -top-1 h-4 min-w-4 px-1"
              : "ml-auto min-w-5 px-1.5 py-1"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
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
