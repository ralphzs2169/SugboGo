import { useEffect, useRef } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

import { linkBase } from "./SidebarLink";
import SidebarDropdownItems from "./SidebarDropdownItems";
import Tooltip from "@/shared/components/actions/Tooltip";
import Flyout from "@/shared/components/overlay/Flyout";

/**
 * Reusable collapsible sidebar dropdown.
 *
 * Supports both:
 * - Expanded sidebar with inline nested navigation.
 * - Collapsed sidebar with a flyout menu and tooltip.
 * @component
 * @param {Object} props
 * @param {string} props.label - Dropdown label.
 * @param {React.Component} props.Icon - Icon component for the dropdown.
 * @param {React.ReactNode[]} props.children - Nested navigation items.
 * @param {Function} props.onClick - Click handler for nested items.
 * @param {boolean} props.isCollapsed - Whether the sidebar is collapsed.
 * @param {boolean} props.isOpen - Whether the dropdown is open.
 * @param {Function} props.onToggle - Toggle handler for the dropdown.
 */
export default function SidebarDropdown({
  label,
  Icon,
  children,
  onClick,
  isCollapsed,
  isOpen,
  onToggle,
  hasActiveChild,
}) {
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const flyoutRef = useRef(null);

  // Close the flyout when the user clicks anywhere outside
  // the dropdown trigger or the flyout panel.
  useEffect(() => {
    if (!isCollapsed || !isOpen) return;

    function handleClickOutside(event) {
      const clickedButton = dropdownRef.current?.contains(event.target);
      const clickedFlyout = flyoutRef.current?.contains(event.target);

      // Ignore clicks inside the dropdown or flyout.
      // Close the flyout only when clicking elsewhere.
      if (!clickedButton && !clickedFlyout) {
        onToggle?.();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCollapsed, isOpen, onToggle]);

  const trigger = (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={label}
      // Keep the parent dropdown highlighted while one of its
      // child routes is active, even if the dropdown is collapsed.
      className={`
        ${linkBase}
        ${isCollapsed ? "h-10 w-10 justify-center" : "w-full gap-3 px-2 py-3"}
        cursor-pointer
        ${
          hasActiveChild && !isOpen
            ? "bg-primary text-white"
            : "text-text-primary hover:bg-interaction-hover"
        }
      `}
    >
      <Icon className="h-5 w-5 shrink-0" />

      <>
        <span
          className={` flex-1 truncate overflow-hidden whitespace-nowrap text-left transition-all duration-300
                     ${hasActiveChild ? "font-semibold" : ""} 
                     ${isCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"}`}
        >
          {label}
        </span>

        {!isCollapsed &&
          (isOpen ? (
            <FiChevronDown
              className={`h-4 w-4 ${
                hasActiveChild ? "text-white" : "text-text-secondary"
              }`}
            />
          ) : (
            <FiChevronRight
              className={`h-4 w-4 ${
                hasActiveChild ? "text-white" : "text-text-secondary"
              }`}
            />
          ))}
      </>
    </button>
  );

  return (
    <div ref={dropdownRef} className="relative">
      {isCollapsed ? (
        <Tooltip content={label} place="right" asChild>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}

      {/* Expanded sidebar submenu */}
      {isOpen && !isCollapsed && (
        <div
          className={`ml-4 mt-1 space-y-1 pl-4 ${
            hasActiveChild
              ? "border-l-2 border-primary"
              : "border-l border-stroke-strong"
          }`}
        >
          <SidebarDropdownItems
            links={children}
            onClick={onClick}
            isSidebarCollapsed={isCollapsed}
          />
        </div>
      )}

      {/* Collapsed sidebar flyout */}
      <Flyout
        ref={flyoutRef}
        anchorRef={buttonRef}
        open={isCollapsed && isOpen}
      >
        <div className="w-56 rounded-lg border border-stroke bg-background p-2 shadow-lg">
          <SidebarDropdownItems links={children} onClick={onClick} collapsed />
        </div>
      </Flyout>
    </div>
  );
}
