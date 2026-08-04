import React from "react";
import TableTabs from "./TableTabs";
import TableControls from "./TableControls";
import TableHeader from "./TableHeader";
import TableBody from "./TableBody";
import TablePagination from "./TablePagination";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import TableSkeletonBody from "./TableSkeletonBody";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";

/**
 * Reusable server-side capable data table powered by TanStack Table.
 *
 * Manages table rendering while keeping state controlled by the parent.
 * Supports external filtering, sorting, pagination, custom actions,
 * and feature-specific UI injection through slots.
 *
 */
function DataTable({
  // Data
  data,
  columns,

  // Loading state
  isLoading = false,
  isFetching = false,

  // Controlled table state
  state,
  pagination,
  pageCount,
  totalItems,

  // State change handlers
  onSortingChange,
  onGlobalFilterChange,
  onColumnFiltersChange,
  onPaginationChange,

  // UI behavior
  hasActiveFilters,
  onResetFilters,
  onRowClick,

  // Configuration
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

  const showSkeleton = useDelayedLoading(isLoading);

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
    <div className="w-full rounded-sm border border-stroke bg-background pb-6 px-6 pt-2 relative">
      <div className="mb-6">
        <TableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

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
        <div className="min-h-[520px] bg-surface rounded-md">
          <table className="w-full border-collapse table-fixed text-left">
            <TableHeader table={table} />

            {isLoading ? (
              showSkeleton ? (
                <TableSkeletonBody
                  columns={table.getVisibleLeafColumns()}
                  rowCount={pagination.pageSize}
                />
              ) : null
            ) : (
              <TableBody
                table={table}
                emptyState={emptyState}
                onRowClick={onRowClick}
              />
            )}
          </table>
        </div>
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
