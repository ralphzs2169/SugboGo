import { useMemo } from "react";
import { Activity } from "lucide-react";
import Button from "@/shared/components/Button";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/data-table/DataTable";
import TableTabs from "../components/data-table/TableTabs";
import RowsPerPageMenu from "../components/data-table/RowsPerPageMenu";
import { ACTIVITY_CATEGORIES } from "../activity-logs/constants/activityLogOptions";
import ActivityLogFilters from "../activity-logs/components/ActivityLogFilters";
import ActivityLogDrawer from "../activity-logs/components/ActivityLogDrawer";
import activityLogColumns from "../activity-logs/columns/activityLogColumns";
import { useActivityLogs } from "../activity-logs/hooks/useActivityLogs";
import useActivityLogTableState from "../activity-logs/hooks/useActivityLogTableState";

/** Provide the read-only system history using the existing management table and drawer patterns. */
export default function ActivityLogsPage() {
  useDocumentTitle("Activity Logs | SugboGo Admin");
  const table = useActivityLogTableState();
  const { state } = table;
  const list = useActivityLogs(table.params);
  const columns = useMemo(
    () => activityLogColumns(table.selectEvent),
    [table.selectEvent],
  );
  const metadata = list.data?.pagination;
  const pagination = {
    pageIndex: metadata ? metadata.page - 1 : state.page - 1,
    pageSize: metadata?.page_size ?? state.page_size,
  };

  useApiErrorNotification(list.error, {
    toastId: "admin-activity-list-load-error",
    fallbackMessage: "Unable to load activity logs. Please try again.",
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Activity Logs"
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel" },
          { label: "System" },
          { label: "Activity Logs" },
        ]}
      />
      <p className="mb-6 text-sm text-text-secondary">
        View and track significant actions across SugboGo.
      </p>
      <div className="mb-4 overflow-x-auto pb-1">
        <TableTabs
          tabs={ACTIVITY_CATEGORIES}
          activeTab={state.category}
          onTabChange={(category) => table.changeFilters({ category })}
          tabListId="activity-categories"
          ariaLabel="Activity categories"
        />
      </div>
      <section
        role="tabpanel"
        id={`activity-categories-panel-${state.category}`}
        aria-labelledby={`activity-categories-${state.category}`}
        className="min-w-0"
      >
        <DataTable
          data={list.data?.items ?? []}
          columns={columns}
          isLoading={list.isLoading}
          isFetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          state={{ sorting: [] }}
          pagination={pagination}
          pageCount={metadata?.total_pages ?? 0}
          totalItems={metadata?.total_items ?? 0}
          onPaginationChange={table.changePagination}
          hasActiveFilters={table.hasActiveFilters}
          onResetFilters={table.resetFilters}
          config={{
            tableLabel: "Activity logs",
            tableMinWidth: 1515,
            showSearch: false,
            scrollbarClassName: "themed-scrollbar",
            emptyState: {
              title: "No activity records available",
              description: "Recorded activities across SugboGo will appear here.",
              icon: <Activity aria-hidden="true" className="h-10 w-10 text-text-secondary" />,
            },
            noResultsState: {
              title: "No activities match your filters",
              description: (
                <span>
                  Try another selection or date range.{" "}
                  <button
                    type="button"
                    onClick={table.resetFilters}
                    className="rounded font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-info"
                  >
                    Clear activity filters
                  </button>
                </span>
              ),
            },
            errorState: {
              title: "Unable to load activity logs",
              message: "The activity records could not be loaded. Your filters and page are preserved.",
            },
          }}
          slots={{
            renderFilters: () => (
              <ActivityLogFilters filters={state} onChange={table.changeFilters} />
            ),
            renderHeaderActions: () => (
              <div className="flex flex-wrap items-center gap-2">
                {list.error?.response?.status === 404 && state.page > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => table.changePagination({
                      pageIndex: 0,
                      pageSize: state.page_size,
                    })}
                  >
                    Return to first page
                  </Button>
                )}
                <RowsPerPageMenu
                  ariaLabel="Activities per page"
                  value={state.page_size}
                  onChange={(pageSize) => table.changePagination({ pageIndex: 0, pageSize })}
                />
              </div>
            ),
          }}
        />
      </section>
      {state.event_id && (
        <ActivityLogDrawer
          key={state.event_id}
          eventId={state.event_id}
          onClose={() => table.selectEvent(null)}
        />
      )}
    </div>
  );
}
