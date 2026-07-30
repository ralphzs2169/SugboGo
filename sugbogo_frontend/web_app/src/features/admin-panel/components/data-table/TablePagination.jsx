import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-side pagination footer.
 * Displays current record range and page navigation.
 *
 * @param {number} pageIndex - Current page index (0 based).
 * @param {number} pageCount - Total available pages.
 * @param {number} totalItems - Total records from API.
 * @param {number} pageSize - Number of records per page.
 * @param {Function} onPageChange - Updates the current page.
 */
function TablePagination({
  pageIndex = 0,
  pageCount = 0,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}) {
  // Prevent invalid API values from breaking pagination display.
  const safeTotalItems = Number(totalItems) || 0;
  const startItem = safeTotalItems === 0 ? 0 : pageIndex * pageSize + 1;

  const endItem =
    safeTotalItems === 0
      ? 0
      : Math.min((pageIndex + 1) * pageSize, safeTotalItems);

  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-stroke/40">
      <p className="text-[11px] font-medium text-text-secondary">
        Showing {startItem} to {endItem} of {safeTotalItems} results
      </p>

      <div className="flex items-center gap-1">
        <button
          disabled={pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f27e13] text-white text-xs font-bold shadow-sm">
          {pageIndex + 1}
        </button>

        <button
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
