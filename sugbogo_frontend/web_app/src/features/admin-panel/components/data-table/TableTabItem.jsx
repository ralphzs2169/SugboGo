import TableTabBadge from "./TableTabBadge";

/**
 * Renders an individual animated segment within the TableTabs control.
 *
 * The active state uses a sliding background indicator while the tab content
 * smoothly transitions between active and inactive styling.
 */
function TableTabItem({
  tab,
  isActive,
  onClick,
  buttonProps,
  size = "md",
}) {
  const Icon = tab.icon;
  const isSmall = size === "sm";

  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onClick}
      className={`relative cursor-pointer rounded-md font-medium transition-colors duration-200 ${
        isSmall ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-[13px]"
      } ${
        isActive
          ? "text-text-primary"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {/* Active background */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-md bg-background shadow-sm transition-all duration-200 ease-out ${
          isActive ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      />

      {/* Tab content */}
      <span className={`relative z-10 flex items-center ${isSmall ? "gap-1.5" : "gap-2"}`}>
        {Icon && <Icon className={isSmall ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />}

        {tab.label}

        {tab.count !== undefined && (
          <TableTabBadge count={tab.count} isActive={isActive} />
        )}
        {tab.countLoading && (
          <span aria-hidden="true" className="h-4 w-5 animate-pulse rounded-full bg-surface-muted" />
        )}
      </span>
    </button>
  );
}

export default TableTabItem;
