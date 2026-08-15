import React from "react";
import { flexRender } from "@tanstack/react-table";
import TableEmptyState from "./TableEmptyState";

/**
 * Renders the table body rows and the table's empty state.
 */
export default function TableBody({ table, emptyState, onRowClick }) {
  const rows = table.getRowModel().rows;

  return (
    <tbody className="bg-background">
      {rows.length > 0 ? (
        rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            className={`h-[60px] border-b border-stroke last:border-b-0 ${
              onRowClick
                ? "cursor-pointer transition-colors hover:bg-interaction-hover"
                : ""
            }`}
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={`min-w-0 overflow-hidden px-4 py-2 align-middle ${
                  cell.column.id === "actions" ? "text-center" : ""
                }`}
              >
                <div className="min-w-0 break-words">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </td>
            ))}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={table.getVisibleLeafColumns().length} className="p-0">
            <TableEmptyState {...emptyState} />
          </td>
        </tr>
      )}
    </tbody>
  );
}
