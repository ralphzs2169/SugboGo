import { useNavigate } from "react-router-dom";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";

import getBusinessApplicationColumns from "../columns/businessApplicationColumns";
import useBusinessApplications from "../hooks/useBusinessApplications";
import useBusinessApplicationTableState from "../hooks/useBusinessApplicationTableState";

/**
 * Management panel for merchant business applications.
 *
 * Handles application listing, server-side search, sorting, pagination,
 * and navigation to the dedicated application review page.
 */
export default function BusinessApplicationManagementPanel() {
  const navigate = useNavigate();

  // Table state
  const {
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useBusinessApplicationTableState();

  // Data
  const {
    applications,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useBusinessApplications(params);

  // Navigate to the dedicated application review page.
  function handleReviewApplication(application) {
    navigate(`/admin-panel/business/application/${application.id}`);
  }

  const columns = getBusinessApplicationColumns(handleReviewApplication);

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
      config={{
        searchPlaceholder: "Search business applications...",
        emptyState: {
          title: "No business applications found",
          description:
            "Try adjusting your search or check back when new applications are submitted.",
        },
        errorState: {
          title: "Unable to load business applications",
          message: "The requested business applications could not be loaded.",
        },
      }}
    />
  );
}
