import { useNavigate } from "react-router-dom";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FileText } from "lucide-react";
import getBusinessApplicationColumns from "../columns/businessApplicationColumns";
import useBusinessApplications from "../hooks/useBusinessApplications";
import useBusinessApplicationTableState from "../hooks/useBusinessApplicationTableState";

/**
 * Management panel for merchant business applications.
 *
 * Handles server-side search, status filtering, queue-status filtering,
 * sorting, pagination, and navigation to the dedicated application review page.
 */
export default function BusinessApplicationManagementPanel() {
  const navigate = useNavigate();

  const {
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    queueStatusFilter,
    setQueueStatusFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useBusinessApplicationTableState();

  const {
    applications,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useBusinessApplications(params);

  function handleReviewApplication(application) {
    navigate(`/admin-panel/business/application/${application.id}`);
  }

  const columns = getBusinessApplicationColumns(handleReviewApplication);

  function renderFilters() {
    return (
      <>
        {/* Application status filter */}
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 cursor-pointer rounded-full border border-stroke-strong bg-background px-4 text-sm text-text-primary outline-none focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          aria-label="Filter applications by status"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="rejected">Rejected</option>
          <option value="approved">Approved</option>
        </select>

        {/* Queue status filter */}
        <select
          value={queueStatusFilter}
          onChange={(event) => setQueueStatusFilter(event.target.value)}
          className="h-9 cursor-pointer rounded-full border border-stroke-strong bg-background px-4 text-sm text-text-primary outline-none focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          aria-label="Filter applications by queue status"
        >
          <option value="">All queue statuses</option>
          <option value="on_time">On time</option>
          <option value="approaching">Approaching</option>
          <option value="overdue">Overdue</option>
          <option value="resolved">Resolved</option>
        </select>
      </>
    );
  }

  return (
    <DataTable
      data={applications}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={refetch}
      pagination={pagination}
      state={{
        globalFilter,
        sorting,
      }}
      pageCount={pageCount}
      totalItems={totalItems}
      onPaginationChange={setPagination}
      onGlobalFilterChange={setGlobalFilter}
      onSortingChange={setSorting}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      slots={{
        renderFilters,
      }}
      config={{
        searchPlaceholder: "Search business applications...",

        emptyState: {
          title: "No business applications yet",
          description:
            "New applications will appear here once merchants submit them.",
          icon: <FileText className="h-10 w-10 text-text-secondary" />,
        },

        noResultsState: {
          title: "No business applications found",
        },

        errorState: {
          title: "Unable to load business applications",
          message: "The requested business applications could not be loaded.",
        },
      }}
    />
  );
}
