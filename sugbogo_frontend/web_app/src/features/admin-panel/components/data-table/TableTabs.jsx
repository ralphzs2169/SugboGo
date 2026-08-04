import TableTabItem from "./TableTabItem";

/**
 * Segmented horizontal navigation layout used to view subsets of data.
 *
 * @component
 * @param {Array<Object>} [tabs=[]] - List of tab configurations.
 * @param {string} activeTab - Currently selected tab ID.
 * @param {Function} onTabChange - Updates active tab.
 */
function TableTabs({ tabs = [], activeTab, onTabChange }) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-stroke">
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
