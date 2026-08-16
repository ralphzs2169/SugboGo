import { useNavigate } from "react-router-dom";
import { Clock, FileText, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import getBusinessApplicationColumns from "../columns/businessApplicationColumns";
import useBusinessApplications from "../hooks/useBusinessApplications";
import useBusinessApplicationTableState from "../hooks/useBusinessApplicationTableState";
import FilterPill from "../../components/FilterPill";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useEffect } from "react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Pending Review" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
];

const QUEUE_STATUS_OPTIONS = [
  { value: "on_time", label: "On time" },
  { value: "approaching", label: "Approaching" },
  { value: "overdue", label: "Overdue" },
  { value: "resolved", label: "Resolved" },
];

/**
 * Management panel for merchant business applications.
 *
 * Handles server-side search, status filtering, queue-status filtering,
 * sorting, pagination, and navigation to the dedicated application review page.
 */
export default function BusinessApplicationManagementTable() {
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
        <FilterPill
          icon={Tag}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Queue status filter */}
        <FilterPill
          icon={Clock}
          placeholder="All queue statuses"
          options={QUEUE_STATUS_OPTIONS}
          value={queueStatusFilter}
          onChange={setQueueStatusFilter}
        />
      </>
    );
  }

  useApiErrorNotification(error, {
    toastId: "business-applications-load-error",
    fallbackMessage: "Unable to load business applications. Please try again.",
  });
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
        searchPlaceholder: "Search merchant applications...",

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
