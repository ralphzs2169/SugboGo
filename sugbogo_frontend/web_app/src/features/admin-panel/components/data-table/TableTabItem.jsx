import TableTabBadge from "./TableTabBadge";

/**
 * Individual tab button used inside TableTabs.
 *
 * Supports optional icons and count badges.
 *
 * @component
 *
 * @param {Object} props
 * @param {Object} props.tab - Tab configuration object.
 * @param {boolean} props.isActive - Whether this tab is selected.
 * @param {Function} props.onClick - Tab change callback.
 *
 * @returns {JSX.Element}
 */
function TableTabItem({ tab, isActive, onClick }) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={`rounded-md px-6 py-3 text-[13px] cursor-pointer font-medium flex items-center gap-2 relative ${
        isActive
          ? "text-primary"
          : "text-text-primary hover:bg-interaction-hover"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}

      {tab.label}

      {tab.count !== undefined && (
        <TableTabBadge count={tab.count} isActive={isActive} />
      )}

      <div
        className={`absolute bottom-0 left-0 h-0.5 w-full origin-center bg-primary transition-transform duration-300 ease-out ${
          isActive ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </button>
  );
}

export default TableTabItem;
