import TableTabItem from "./TableTabItem";

/**
 * Renders a compact animated segmented control for switching between data views.
 *
 * The active background smoothly slides between tabs while inactive tabs
 * transition their text styling.
 */
function TableTabs({ tabs = [], activeTab, onTabChange, tabListId, ariaLabel = "Analytics topics" }) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div style={tabListId ? { minWidth: "max-content" } : undefined} role={tabListId ? "tablist" : undefined} aria-label={tabListId ? ariaLabel : undefined} className="mt-2 inline-flex items-center rounded-lg bg-sidebar-active p-1">

      {tabs.map((tab) => (
        <TableTabItem
          buttonProps={tabListId ? {
            role: "tab",
            id: `${tabListId}-${tab.id}`,
            "aria-controls": `${tabListId}-panel-${tab.id}`,
            "aria-selected": activeTab === tab.id,
            tabIndex: activeTab === tab.id ? 0 : -1,
            onKeyDown: (event) => {
              const current = tabs.findIndex((item) => item.id === tab.id);
              const next = { ArrowRight: (current + 1) % tabs.length, ArrowLeft: (current + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
              if (next === undefined) return;
              event.preventDefault();
              onTabChange?.(tabs[next].id);
              document.getElementById(`${tabListId}-${tabs[next].id}`)?.focus();
            },
          } : undefined}
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
