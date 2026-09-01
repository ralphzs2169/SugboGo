import React, { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { FaRotateLeft } from "react-icons/fa6";

/**
 * Renders the controls for a data table, including search input, filters, and header actions.
 */
function TableControls({
  globalFilter,
  setGlobalFilter,
  searchPlaceholder,
  renderFilters,
  renderHeaderActions,
  hasActiveFilters,
  onResetFilters,
  isSearching = false,
}) {
  const inputRef = useRef(null);
  const wasFocusedRef = useRef(false);

  // If the table is searching, we want to remember if the search input was focused.
  // If it was, we want to refocus it after the search is done.
  useEffect(() => {
    if (isSearching) {
      wasFocusedRef.current = document.activeElement === inputRef.current;
    } else if (
      wasFocusedRef.current &&
      document.activeElement !== inputRef.current
    ) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isSearching]);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:w-72 md:w-96 lg:w-[420px]">
          {isSearching ? (
            <span className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-stroke-strong border-t-primary" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          )}

          <input
            ref={inputRef}
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

      {renderHeaderActions && (
        <div className="flex items-center justify-end">
          {renderHeaderActions()}
        </div>
      )}
    </div>
  );
}

export default TableControls;
