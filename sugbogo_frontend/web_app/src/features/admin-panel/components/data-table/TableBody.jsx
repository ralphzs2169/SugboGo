import React from "react";
import { flexRender } from "@tanstack/react-table";
import TableEmptyState from "./TableEmptyState";

/**
 * Renders the table body rows.
 */
export default function TableBody({ table, emptyState, onRowClick }) {
  const rows = table.getRowModel().rows;

  return (
    <tbody className="divide-y divide-stroke/60 bg-background/30">
      {rows.length > 0 ? (
        rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            className={`h-[52px] bg-background hover:bg-interaction-hover transition-colors ${
              onRowClick ? "cursor-pointer" : ""
            }`}
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={`px-4 py-2 align-middle ${
                  cell.column.id === "actions" ? "text-center" : ""
                }`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))
      ) : (
        <tr>
          <td
            colSpan={table.getVisibleLeafColumns().length}
            className="h-[420px]"
          >
            <TableEmptyState {...emptyState} />
          </td>
        </tr>
      )}
    </tbody>
  );
}
