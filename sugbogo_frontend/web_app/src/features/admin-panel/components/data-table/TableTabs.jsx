import TableTabItem from "./TableTabItem";

/**
 * Segmented horizontal navigation layout used to view subsets of data.
 *
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
