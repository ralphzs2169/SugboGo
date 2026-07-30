import React from "react";
import { Search } from "lucide-react";
import { FaRotateLeft } from "react-icons/fa6";

/**
 * Table control toolbar containing global search,
 * filter actions, and feature-specific header actions.
 *
 * Supports custom filter UI and action buttons through render props,
 * allowing individual tables to inject feature-specific controls.
 *
 * @component
 *
 * @param {Object} props
 * @param {string} props.globalFilter - Current search input value.
 * @param {Function} props.setGlobalFilter - Updates the search query state.
 * @param {string} props.searchPlaceholder - Search input placeholder text.
 * @param {Function} [props.renderFilters] - Renders custom filter controls.
 * @param {Function} [props.renderHeaderActions] - Renders action buttons.
 * @param {boolean} props.hasActiveFilters - Determines whether reset action is shown.
 * @param {Function} props.onResetFilters - Clears active filters and sorting.
 *
 * @returns {JSX.Element}
 */
function TableControls({
  globalFilter,
  setGlobalFilter,
  searchPlaceholder,
  renderFilters,
  renderHeaderActions,
  hasActiveFilters,
  onResetFilters,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Field */}
        <div className="relative w-full sm:w-72 md:w-96 lg:w-[420px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />

          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 rounded-full border border-stroke-strong bg-background py-2 pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-slate-400 focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          />
        </div>

        {renderFilters && renderFilters()}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-stroke-active hover:bg-interaction-hover"
          >
            <FaRotateLeft className="h-4 w-4" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Fixed right-side actions */}
      {renderHeaderActions && (
        <div className="flex items-center justify-end">
          {renderHeaderActions()}
        </div>
      )}
    </div>
  );
}

export default TableControls;
