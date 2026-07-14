import React from "react";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa6";
import TableTabs from "./TableTabs";
import TableControls from "./TableControls";
import TableHeader from "./TableHeader";
import TableBody from "./TableBody";
import TablePagination from "./TablePagination";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";

/**
 * A reusable, stateless data table core powered by TanStack Table.
 * Fully styled for the admin dashboard and controlled entirely by its parent.
 *
 * @component
 * @param {Array<Object>} data - The raw array of data objects from your API.
 * @param {Array<Object>} columns - TanStack column definitions.
 * @param {Object} state - Hoisted state containing sorting, globalFilter, and columnFilters.
 * @param {function} onSortingChange - Parent state setter for sorting.
 * @param {function} onGlobalFilterChange - Parent state setter for global search text.
 * @param {function} onColumnFiltersChange - Parent state setter for dropdown column filters.
 * @param {Object} [config] - Optional configuration settings for UI text and tabs.
 * @param {Object} [slots] - Optional UI markup injection layout fragments.
 */
function DataTable({
  data,
  columns,
  state,
  onSortingChange,
  onGlobalFilterChange,
  onColumnFiltersChange,
  hasActiveFilters,
  onResetFilters,
  config = {},
  slots = {},
}) {
  // Extract UI configurations with defaults
  const {
    tabs = [],
    activeTab,
    onTabChange,
    searchPlaceholder = "Search...",
    footerMetaText,
    emptyState = {},
  } = config;

  // Extract layout injection functions
  const { renderFilters, renderFloatingAction } = slots;

  const table = useReactTable({
    data,
    columns,
    state,
    onGlobalFilterChange,
    onColumnFiltersChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const {
    title = "No data available",
    description = "There are currently no records to display.",
    icon = null,
  } = emptyState;

  return (
    <div className="w-full rounded-lg border border-stroke bg-background-primary pb-6 px-6 pt-2 shadow-sm relative">
      {/* Category Navigation Tabs */}
      <TableTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

      {/* Command Controls Header Bar */}
      <TableControls
        globalFilter={state.globalFilter ?? ""}
        setGlobalFilter={onGlobalFilterChange}
        searchPlaceholder={searchPlaceholder}
        renderFilters={renderFilters}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
      />

      {/* Render Table Content Viewframe */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <TableHeader table={table} />

          {/* Table Body */}
          <TableBody table={table} emptyState={emptyState} />
        </table>
      </div>

      {/* Navigation Status Footer Component */}
      <TablePagination footerMetaText={footerMetaText} />

      {/* Floating Action Button Attachment */}
      {renderFloatingAction && renderFloatingAction()}
    </div>
  );
}

export default DataTable;
