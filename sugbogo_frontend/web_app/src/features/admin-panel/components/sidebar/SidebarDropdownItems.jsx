import { NavLink } from "react-router-dom";

/**
 * Renders the nested navigation links for a sidebar dropdown.
 *
 * Supports both:
 * - Expanded sidebar with compact nested links.
 * - Collapsed sidebar flyout with larger touch targets.
 *
 * @component
 *
 * @param {Object} props
 * @param {Array<{to: string, label: string}>} props.links - Navigation links to render.
 * @param {function} props.onClick - Invoked after selecting a link.
 * @param {boolean} [props.collapsed=false] - Whether the links are rendered inside the collapsed sidebar flyout.
 *
 * @returns {JSX.Element}
 */
export default function SidebarDropdownItems({
  links,
  onClick,
  isSidebarCollapsed = false,
}) {
  return (
    <>
      {links.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClick}
          className={({ isActive }) =>
            `block rounded-lg font-medium transition
     px-2 py-2 text-[12px]
     ${
       isActive
         ? "bg-primary text-white"
         : "text-text-primary hover:bg-interaction-hover"
     }`
          }
        >
          <span
            className={`
      block truncate overflow-hidden whitespace-nowrap
      transition-all duration-300
      ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"}
    `}
          >
            {item.label}
          </span>
        </NavLink>
      ))}
    </>
  );
}
