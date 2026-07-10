import { NavLink } from "react-router-dom";

// Common base styles for sidebar links
export const linkBase =
  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition duration-200";

/**
 * Sidebar navigation link component for the admin panel.
 * Renders a link with an icon and label, applying active state
 * styles when the current route matches the link's target.
 *
 * @component
 * @param {string} to - The target route path for the link.
 * @param {string} label - The display text for the link.
 * @param {React.Component} Icon - The icon component to display alongside the label.
 * @param {function} onClick - Optional click handler for the link.
 */
function SidebarLink({ to, label, Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `${linkBase} ${
          isActive
            ? "bg-primary text-white"
            : "text-text-primary hover:bg-interaction-hover"
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default SidebarLink;
