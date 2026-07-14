import React from "react";
import { flexRender } from "@tanstack/react-table";
import TableEmptyState from "./TableEmptyState";

/**
 * Renders the table body rows. Automatically displays a configurable
 * empty state whenever no rows remain after filtering, searching,
 * or when the dataset itself is empty.
 *
 * @component
 * @param {Object} table - TanStack Table instance created by useReactTable().
 * @param {Object} emptyState - Configuration object passed to the empty state view.
 * @param {string} emptyState.title - Primary heading displayed when no rows exist.
 * @param {string} emptyState.description - Supporting message explaining the empty state.
 * @param {React.ReactNode} [emptyState.icon] - Optional icon or illustration displayed above the text.
 */
function TableBody({ table, emptyState }) {
  return (
    <tbody className="divide-y divide-stroke/60">
      {table.getRowModel().rows.length > 0 ? (
        table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className="hover:bg-interaction-hover transition-colors"
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="py-2 align-middle">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={table.getAllColumns().length} className="py-6">
            <TableEmptyState {...emptyState} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

export default TableBody;
