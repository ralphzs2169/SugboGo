import { flexRender } from "@tanstack/react-table";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa6";

/**
 * Table header renderer for TanStack Table.
 * Displays column labels, sorting controls, and active sort indicators.
 *
 * Sorting state is controlled externally. When manualSorting is enabled,
 * sorting changes are handled by the parent component for server-side queries.
 *
 * @component
 *
 * @param {Object} props
 * @param {Object} props.table - TanStack Table instance.
 *
 * @returns {JSX.Element}
 */
function TableHeader({ table }) {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort();
            const isSorted = header.column.getIsSorted();
            const HeaderContent = canSort ? "button" : "div";
            let ariaSort;

            if (canSort) {
              ariaSort = "none";
              if (isSorted === "asc") {
                ariaSort = "ascending";
              } else if (isSorted === "desc") {
                ariaSort = "descending";
              }
            }

            return (
              <th
                key={header.id}
                scope="col"
                aria-sort={ariaSort}
                className={`border-b border-stroke-strong px-4 py-3 text-[14px] bg-surface-muted font-medium text-text-primary select-none group/th ${
                  canSort ? "cursor-pointer hover:text-text-hover" : ""
                } ${header.id === "actions" ? "text-center" : "text-left"}`}
                style={{
                  width: header.getSize(),
                }}
              >
                <HeaderContent
                  type={canSort ? "button" : undefined}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  className={`flex min-h-8 w-full items-center gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-info ${canSort ? "cursor-pointer" : ""} ${
                    header.id === "actions" ? "justify-center" : ""
                  }`}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}

                  {canSort && (
                    <span className="flex items-center justify-center transition-colors">
                      {isSorted === "asc" && (
                        <FaSortUp className="h-4 w-4 text-text-primary translate-y-[2px]" />
                      )}

                      {isSorted === "desc" && (
                        <FaSortDown className="h-4 w-4 text-text-primary -translate-y-[2px]" />
                      )}

                      {!isSorted && (
                        <FaSort className="h-3.5 w-3.5 text-text-primary opacity-50 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </span>
                  )}
                </HeaderContent>
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}

export default TableHeader;
