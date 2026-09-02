import { useNavigate } from "react-router-dom";
import { FileWarning, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import getReviewDisputeColumns from "../columns/reviewDisputeColumns";
import useReviewDisputes from "../hooks/useReviewDisputes";
import useReviewDisputeTableState from "../hooks/useReviewDisputeTableState";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "upheld", label: "Upheld" },
  { value: "dismissed", label: "Dismissed" },
];

export default function ReviewDisputeManagementTable() {
  const navigate = useNavigate();

  const {
    statusFilter,
    setStatusFilter,
    reasonFilter,
    setReasonFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useReviewDisputeTableState();

  const {
    disputes,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useReviewDisputes(params);

  useApiErrorNotification(error, {
    toastId: "review-disputes-load-error",
    fallbackMessage: "Unable to load review disputes. Please try again.",
  });

  function handleViewDispute(dispute) {
    navigate(`/admin-panel/review-disputes/${dispute.id}`);
  }

  const columns = getReviewDisputeColumns(handleViewDispute);

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
        ]}
      />
    );
  }

  return (
    <DataTable
      data={disputes}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={refetch}
      pagination={pagination}
      state={{
        sorting,
      }}
      pageCount={pageCount}
      totalItems={totalItems}
      onPaginationChange={setPagination}
      onSortingChange={setSorting}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      config={{
        searchPlaceholder: "Search review disputes...",
        emptyState: {
          title: "No review disputes yet",
          description:
            "Merchant review disputes will appear here when submitted.",
          icon: <FileWarning className="h-10 w-10 text-text-secondary" />,
        },
        noResultsState: {
          title: "No review disputes found",
        },
        errorState: {
          title: "Unable to load review disputes",
          message: "The requested review disputes could not be loaded.",
        },
      }}
      slots={{
        renderFilters,
      }}
    />
  );
}
