import TableTabs from "./TableTabs";
import TableControls from "./TableControls";
import TableViewControls from "./TableViewControls";
import TableHeader from "./TableHeader";
import TableBody from "./TableBody";
import TablePagination from "./TablePagination";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import TableSkeletonBody from "./TableSkeletonBody";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import { SearchX } from "lucide-react";
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
  getRowId,

  // Loading state
  isLoading = false,
  isFetching = false,
  isSearching = false,
  error = null,
  onRetry,

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
  const defaultNoResultsState = {
    title: "No results found",
    description: "Try adjusting your search or filters.",
    icon: <SearchX className="h-10 w-10 text-text-secondary" />,
  };

  const {
    tabs = [],
    activeTab,
    onTabChange,
    searchPlaceholder = "Search...",
    defaultSortLabel = "Default order",
    showSearch = true,
    compact = false,
    embedded = false,
    fitContent = false,
    fixedUtilityColumns = false,
    managementControls = false,
    tableLabel,
    tableMinWidth = 720,
    scrollbarClassName = "",

    emptyState = {},
    noResultsState = {},
    errorState = {
      title: "Unable to load data",
      message: "The requested records could not be loaded.",
    },
  } = config;

  const {
    renderFilters,
    renderHeaderActions,
    renderFloatingAction,
    renderContent,
  } = slots;

  // const showSkeleton = useDelayedLoading(isLoading);

  const hasActiveSearchOrFilters =
    Boolean(state.globalFilter?.trim()) || hasActiveFilters;

  const activeEmptyState = hasActiveSearchOrFilters
    ? { ...defaultNoResultsState, ...noResultsState }
    : emptyState;

  // TanStack delegates sorting, filtering, and pagination to external handlers.
  const table = useReactTable({
    data,
    columns,
    getRowId,
    meta: { fixedUtilityColumns },

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

  const visibleColumns = table.getVisibleLeafColumns();
  const utilityIds = ["rowNumber", "created_at", "actions", "is_active"];
  const utilityWidth = visibleColumns.reduce(
    (total, column) => total + (utilityIds.includes(column.id) ? column.getSize() : 0),
    0,
  );
  const contentWidth = table.getTotalSize() - utilityWidth;

  let renderTableActions = renderHeaderActions;

  if (managementControls && !renderContent) {
    renderTableActions = () => (
      <>
        {renderHeaderActions?.()}
        <TableViewControls
          defaultSortLabel={defaultSortLabel}
          table={table}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
        />
      </>
    );
  }

  const showControls =
    !compact ||
    showSearch ||
    renderFilters ||
    renderTableActions ||
    hasActiveFilters;

  return (
    <div
      className={compact || embedded ? "relative min-w-0 w-full" : `relative min-w-0 w-full rounded-2xl border border-stroke bg-background px-3 sm:px-6 ${fitContent ? "pb-4" : "pb-6"} ${tabs.length > 0 ? "pt-2" : fitContent ? "pt-4" : "pt-6"}`}
      aria-busy={isLoading || isFetching}
    >
      {tabs.length > 0 && (
        <div className="mb-6 overflow-x-auto pb-1">
          <TableTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </div>
      )}

      {showControls && (
        <TableControls
          dense={fitContent}
          globalFilter={state.globalFilter ?? ""}
          setGlobalFilter={onGlobalFilterChange}
          searchPlaceholder={searchPlaceholder}
          showSearch={showSearch}
          renderFilters={renderFilters}
          renderHeaderActions={renderTableActions}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={onResetFilters}
          isSearching={isSearching}
        />
      )}

      {renderContent ? (
        renderContent()
      ) : (
        <div className={`${scrollbarClassName || "themed-scrollbar"} ${compact || fitContent ? "" : "min-h-[520px]"} overflow-x-auto overflow-y-hidden rounded-lg border border-stroke-strong bg-surface`}>
          <table
            aria-label={tableLabel}
            className="w-full table-fixed border-collapse text-left"
            style={{ minWidth: tableMinWidth }}
          >
            {fixedUtilityColumns && (
              <colgroup>
                {visibleColumns.map((column) => {
                  let width = column.getSize();
                  if (!utilityIds.includes(column.id)) {
                    const share = column.getSize() / contentWidth;
                    width = `calc(${100 * share}% - ${utilityWidth * share}px)`;
                  }
                  return <col key={column.id} style={{ width }} />;
                })}
              </colgroup>
            )}
            <TableHeader table={table} />

            {isLoading ? (
              <TableSkeletonBody
                columns={table.getVisibleLeafColumns()}
                rowCount={pagination.pageSize}
              />
            ) : error ? (
              <tbody>
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    <DataErrorState
                      title={errorState.title}
                      message={errorState.message}
                      onRetry={onRetry}
                      fullHeight
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <TableBody
                compact={compact}
                table={table}
                emptyState={activeEmptyState}
                onRowClick={onRowClick}
              />
            )}
          </table>
        </div>
      )}

      <TablePagination
        dense={fitContent}
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
