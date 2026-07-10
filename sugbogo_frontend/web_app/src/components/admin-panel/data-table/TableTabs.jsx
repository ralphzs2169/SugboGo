import React from "react";

/**
 * Segmented horizontal navigation layout used to view subsets of data within a feature view.
 * Renders tab list badges, active state sliders, and notification record counters.
 *
 * @component
 * @param {Array<Object>} [tabs=[]] - List of config structures containing unique { id, label, count }.
 * @param {string} activeTab - The matching string ID of the currently active tab viewpoint.
 * @param {function} onTabChange - Callback event handler that shifts parent state to the clicked tab ID.
 */
function TableTabs({ tabs = [], activeTab, onTabChange }) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-stroke mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={`rounded-md  px-6 py-3 text-[13px] cursor-pointer font-medium flex items-center gap-2 relative  ${
              isActive
                ? "text-primary"
                : "text-text-primary hover:bg-interaction-hover"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-gray-900"
                }`}
              >
                {tab.count}
              </span>
            )}
            <div
              className={`absolute bottom-0 left-0 h-0.5 w-full origin-center bg-primary transition-transform duration-300 ease-out ${
                isActive ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default TableTabs;
