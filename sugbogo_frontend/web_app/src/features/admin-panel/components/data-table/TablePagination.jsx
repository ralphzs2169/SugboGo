import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Renders server-side table pagination with a compact page-number
 * navigation model that adapts to the current page and total pages.
 */
function TablePagination({
  pageIndex = 0,
  pageCount = 0,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}) {
  const safePageIndex = Math.max(0, pageIndex);
  const safePageCount = Math.max(0, pageCount);
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);

  const startItem = safeTotalItems === 0 ? 0 : safePageIndex * pageSize + 1;

  const endItem =
    safeTotalItems === 0
      ? 0
      : Math.min((safePageIndex + 1) * pageSize, safeTotalItems);

  const getPageItems = () => {
    if (safePageCount <= 1) {
      return [];
    }

    if (safePageCount <= 5) {
      return Array.from({ length: safePageCount }, (_, index) => index);
    }

    const items = [];

    // Always show the first page.
    items.push(0);

    if (safePageIndex <= 2) {
      items.push(1);
      items.push(2);
      items.push("ellipsis-right");
      items.push(safePageCount - 1);

      return items;
    }

    if (safePageIndex >= safePageCount - 3) {
      items.push("ellipsis-left");
      items.push(safePageCount - 3);
      items.push(safePageCount - 2);
      items.push(safePageCount - 1);

      return items;
    }

    // Current page is somewhere in the middle.
    items.push("ellipsis-left");
    items.push(safePageIndex - 1);
    items.push(safePageIndex);
    items.push(safePageIndex + 1);
    items.push("ellipsis-right");
    items.push(safePageCount - 1);

    return items;
  };

  const pageItems = getPageItems();

  if (safeTotalItems === 0) {
    return (
      <div className="mt-6 flex items-center justify-between border-t border-stroke/40 pt-4">
        <p className="text-[11px] font-medium text-text-secondary">
          No results
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-stroke/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Result range */}
      <p className="text-[11px] font-medium text-text-secondary">
        Showing{" "}
        <span className="font-semibold text-text-primary">
          {startItem}–{endItem}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-text-primary">
          {safeTotalItems}
        </span>{" "}
        results
      </p>

      {/* Page navigation */}
      <nav className="flex items-center gap-1" aria-label="Table pagination">
        {/* Previous page */}
        <button
          type="button"
          disabled={safePageIndex === 0}
          onClick={() => onPageChange(safePageIndex - 1)}
          aria-label="Previous page"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {pageItems.map((item, index) => {
          if (typeof item === "string") {
            return (
              <span
                key={`${item}-${index}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-text-secondary"
              >
                …
              </span>
            );
          }

          const isCurrentPage = item === safePageIndex;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={isCurrentPage ? "page" : undefined}
              className={[
                "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
                isCurrentPage
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              ].join(" ")}
            >
              {item + 1}
            </button>
          );
        })}

        {/* Next page */}
        <button
          type="button"
          disabled={safePageIndex >= safePageCount - 1}
          onClick={() => onPageChange(safePageIndex + 1)}
          aria-label="Next page"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

export default TablePagination;
