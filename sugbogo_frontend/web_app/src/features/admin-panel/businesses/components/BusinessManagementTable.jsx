import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterPill from "../../components/FilterPill";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import BusinessColumns from "../columns/businessColumns";
import useBusinesses from "../hooks/useBusinesses";
import useBusinessTableState from "../hooks/useBusinessTableState";

const STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
  },
  {
    value: "suspended",
    label: "Suspended",
  },
];

/**
 * Management panel for permanent merchant businesses.
 *
 * Handles server-side search, status filtering, sorting, pagination,
 * and navigation to the business detail page.
 */
export default function BusinessManagementTable() {
  const navigate = useNavigate();

  const {
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useBusinessTableState();

  const {
    businesses,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useBusinesses(params);

  function handleViewBusiness(business) {
    navigate(`/admin-panel/businesses/${business.id}`);
  }

  const columns = BusinessColumns(handleViewBusiness);

  function renderFilters() {
    return (
      <>
        {/* Business status filter */}
        <FilterPill
          icon={Tag}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </>
    );
  }

  useApiErrorNotification(error, {
    toastId: "businesses-load-error",
    fallbackMessage: "Unable to load businesses. Please try again.",
  });

  return (
    <DataTable
      data={businesses}
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
        searchPlaceholder: "Search businesses...",

        emptyState: {
          title: "No businesses yet",
          description:
            "Approved merchant businesses will appear here once they are created.",
          icon: <Building2 className="h-10 w-10 text-text-secondary" />,
        },

        noResultsState: {
          title: "No businesses found",
        },

        errorState: {
          title: "Unable to load businesses",
          message: "The requested businesses could not be loaded.",
        },
      }}
    />
  );
}
