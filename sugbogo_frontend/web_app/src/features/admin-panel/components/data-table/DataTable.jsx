import React from "react";
import TableTabs from "./TableTabs";
import TableControls from "./TableControls";
import TableHeader from "./TableHeader";
import TableBody from "./TableBody";
import TablePagination from "./TablePagination";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";

/**
 * Reusable server-side capable data table powered by TanStack Table.
 *
 * Manages table rendering while keeping state controlled by the parent.
 * Supports external filtering, sorting, pagination, custom actions,
 * and feature-specific UI injection through slots.
 *
 * @component
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Current table records.
 * @param {Array<Object>} props.columns - TanStack column definitions.
 * @param {Object} props.state - Controlled table state.
 * @param {Object} props.pagination - Current pagination state.
 * @param {number} props.pageCount - Total available pages.
 * @param {number} props.totalItems - Total records from API.
 * @param {Function} props.onSortingChange - Updates sorting state.
 * @param {Function} props.onGlobalFilterChange - Updates global search state.
 * @param {Function} props.onColumnFiltersChange - Updates column filter state.
 * @param {Function} props.onPaginationChange - Updates pagination state.
 * @param {boolean} props.hasActiveFilters - Controls reset filter visibility.
 * @param {Function} props.onResetFilters - Clears active filters.
 * @param {Function} [props.onRowClick] - Handles row selection.
 * @param {Object} [props.config] - Table UI configuration.
 * @param {Object} [props.slots] - Custom UI render functions.
 *
 * @returns {JSX.Element}
 */
function DataTable({
  data,
  columns,
  state,
  pagination,
  pageCount,
  totalItems,
  onSortingChange,
  onGlobalFilterChange,
  onColumnFiltersChange,
  onPaginationChange,
  hasActiveFilters,
  onResetFilters,
  onRowClick,
  config = {},
  slots = {},
}) {
  const {
    tabs = [],
    activeTab,
    onTabChange,
    searchPlaceholder = "Search...",
    emptyState = {},
  } = config;

  const { renderFilters, renderHeaderActions, renderFloatingAction } = slots;

  // TanStack delegates sorting, filtering, and pagination to external handlers.
  const table = useReactTable({
    data,
    columns,

    state: {
      ...state,
      pagination,
    },

    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,

    onGlobalFilterChange,
    onColumnFiltersChange,
    onSortingChange,
    onPaginationChange,

    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full rounded-lg border border-stroke bg-background-primary pb-6 px-6 pt-2 shadow-sm relative">
      <TableTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

      <TableControls
        globalFilter={state.globalFilter ?? ""}
        setGlobalFilter={onGlobalFilterChange}
        searchPlaceholder={searchPlaceholder}
        renderFilters={renderFilters}
        renderHeaderActions={renderHeaderActions}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
      />

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse table-fixed text-left">
          <TableHeader table={table} />

          <TableBody
            table={table}
            emptyState={emptyState}
            onRowClick={onRowClick}
          />
        </table>
      </div>

      <TablePagination
        pageIndex={pagination.pageIndex}
        pageCount={pageCount}
        totalItems={totalItems}
        pageSize={pagination.pageSize}
        onPageChange={(pageIndex) =>
          onPaginationChange({
            ...pagination,
            pageIndex,
          })
        }
      />

      {renderFloatingAction && renderFloatingAction()}
    </div>
  );
}

export default DataTable;
