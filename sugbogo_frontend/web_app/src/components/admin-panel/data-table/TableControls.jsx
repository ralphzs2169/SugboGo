import React from "react";
import { Search } from "lucide-react";
import { FaRotateLeft } from "react-icons/fa6";

/**
 * Control header bar that manages the layout for global search text inputs,
 * custom filter dropdown injection slots, and active sorting feedback labels.
 *
 * @component
 * @param {string} globalFilter - The current text value typed inside the search field.
 * @param {function} setGlobalFilter - Parent state setter callback to handle search queries.
 * @param {string} [searchPlaceholder] - Customizable descriptive placeholder text for the input box.
 * @param {function} [renderFilters] - Render prop layout function that returns custom dropdown blocks.
 * @param {boolean} [hasActiveFilters] - Flag indicating if any filters are currently applied.
 * @param {function} [onResetFilters] - Callback function to reset all filters and sorting.
 */

function TableControls({
  globalFilter,
  setGlobalFilter,
  searchPlaceholder,
  renderFilters,
  hasActiveFilters,
  onResetFilters,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        {/* Search Field */}
        <div className="relative w-full sm:w-9/12 md:w-7/12 lg:w-5/12">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 rounded-full border border-stroke-strong bg-background-primary py-2 pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-slate-400 focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          {renderFilters && renderFilters()}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md  px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-stroke-active hover:bg-interaction-hover hover:text-text-primary"
            >
              <FaRotateLeft className="h-4 w-4" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TableControls;
