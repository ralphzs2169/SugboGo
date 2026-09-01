import TableTabItem from "./TableTabItem";

/**
 * Renders a compact animated segmented control for switching between data views.
 *
 * The active background smoothly slides between tabs while inactive tabs
 * transition their text styling.
 */
function TableTabs({ tabs = [], activeTab, onTabChange }) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 inline-flex items-center rounded-lg bg-sidebar-active p-1">
      {tabs.map((tab) => (
        <TableTabItem
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange?.(tab.id)}
        />
      ))}
    </div>
  );
}

export default TableTabs;
