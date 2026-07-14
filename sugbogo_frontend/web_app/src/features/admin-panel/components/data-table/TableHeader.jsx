import React from "react";
import { flexRender } from "@tanstack/react-table";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa6";

/**
 * Renders the table header groups, including
 * sortable column headers and visual sorting indicators for ascending,
 * descending, and unsorted states.
 *
 * @component
 * @param {Object} table - TanStack Table instance created by useReactTable().
 */
function TableHeader({ table }) {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className="border-y border-stroke-strong">
          {/* Header Cells */}
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort();
            const isSorted = header.column.getIsSorted();

            return (
              <th
                key={header.id}
                className={`py-3 text-[14px] font-medium text-text-primary select-none group/th ${
                  canSort ? "cursor-pointer hover:text-text-hover" : ""
                }`}
                onClick={header.column.getToggleSortingHandler()}
              >
                <div className="flex items-center gap-1.5">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {canSort && (
                    <span className="transition-colors flex items-center justify-center">
                      {/* Ascending State */}
                      {isSorted === "asc" && (
                        <FaSortUp className="h-4 w-4 text-text-primary translate-y-[2px]" />
                      )}

                      {/* Descending State */}
                      {isSorted === "desc" && (
                        <FaSortDown className="h-4 w-4 text-text-primary -translate-y-[2px]" />
                      )}

                      {/* Unsorted State */}
                      {!isSorted && (
                        <FaSort className="h-3.5 w-3.5 text-text-primary opacity-50 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}

export default TableHeader;
