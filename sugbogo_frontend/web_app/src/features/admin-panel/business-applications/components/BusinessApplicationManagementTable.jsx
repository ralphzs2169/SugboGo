import { useNavigate } from "react-router-dom";
import { Clock, FileText, Tag, Layers, Tags } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import getBusinessApplicationColumns from "../columns/businessApplicationColumns";
import useBusinessApplications from "../hooks/useBusinessApplications";
import useBusinessApplicationTableState from "../hooks/useBusinessApplicationTableState";
import FilterMenu from "../../../admin-panel/components/data-table/FilterMenu";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useClusters from "../../cluster-category/hooks/useClusters";
import useCategories from "../../cluster-category/hooks/useCategories";

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
 * classification filtering, sorting, pagination, and navigation to the
 * dedicated application review page.
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
    clusterFilter,
    setClusterFilter,
    categoryFilter,
    setCategoryFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
    isSearching,
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

  // Filter option sources — fetched once, not paginated/searched.
  const { clusters } = useClusters({ page_size: 100 });
  const { categories } = useCategories({ page_size: 100 });

  function handleReviewApplication(application) {
    navigate(`/admin-panel/business/application/${application.id}`);
  }

  const columns = getBusinessApplicationColumns(handleReviewApplication);

  function renderFilters() {
    return (
      <FilterMenu
        filters={[
          {
            key: "status",
            label: "Status",
            icon: Tag,
            options: STATUS_OPTIONS,
            value: statusFilter,
            onChange: setStatusFilter,
          },
          {
            key: "queue_status",
            label: "Queue Status",
            icon: Clock,
            options: QUEUE_STATUS_OPTIONS,
            value: queueStatusFilter,
            onChange: setQueueStatusFilter,
          },
          {
            key: "cluster",
            label: "Cluster",
            icon: Layers,
            options: clusters.map((cluster) => ({
              value: String(cluster.id),
              label: cluster.name,
            })),
            value: clusterFilter,
            onChange: setClusterFilter,
          },
          {
            key: "category",
            label: "Category",
            icon: Tag,
            options: categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            })),
            value: categoryFilter,
            onChange: setCategoryFilter,
          },
        ]}
      />
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
      isSearching={isSearching}
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
