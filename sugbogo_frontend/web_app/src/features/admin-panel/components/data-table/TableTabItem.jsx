import TableTabBadge from "./TableTabBadge";

/**
 * Renders an individual animated segment within the TableTabs control.
 *
 * The active state uses a sliding background indicator while the tab content
 * smoothly transitions between active and inactive styling.
 */
function TableTabItem({ tab, isActive, onClick }) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative cursor-pointer rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
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
      <span className="relative z-10 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}

        {tab.label}

        {tab.count !== undefined && (
          <TableTabBadge count={tab.count} isActive={isActive} />
        )}
      </span>
    </button>
  );
}

export default TableTabItem;
