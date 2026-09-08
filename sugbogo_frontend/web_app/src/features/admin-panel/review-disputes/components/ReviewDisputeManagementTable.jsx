import { useNavigate } from "react-router-dom";
import { FileWarning, Flag, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import getReviewDisputeColumns from "../columns/reviewDisputeColumns";
import useReviewDisputes from "../hooks/useReviewDisputes";
import useReviewDisputeTableState from "../hooks/useReviewDisputeTableState";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "upheld", label: "Upheld" },
  { value: "dismissed", label: "Dismissed" },
  { value: "withdrawn", label: "Withdrawn" },
];

const REASON_OPTIONS = [
  { value: "fake_review", label: "Fake or non-genuine review" },
  {
    value: "abusive_content",
    label: "Abusive or inappropriate content",
  },
  {
    value: "misleading_information",
    label: "False or materially misleading information",
  },
  {
    value: "conflict_of_interest",
    label: "Conflict of interest",
  },
  {
    value: "wrong_business",
    label: "Wrong business or unrelated experience",
  },
  { value: "other", label: "Other" },
];

/**
 * Displays the admin review dispute moderation queue.
 *
 * Supports server-backed search, filtering, sorting, pagination, retry states,
 * and navigation to individual dispute moderation details.
 */
export default function ReviewDisputeManagementTable() {
  const navigate = useNavigate();

  const {
    globalFilter,
    setGlobalFilter,

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
    isSearching,
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
          {
            key: "reason",
            label: "Reason",
            icon: Flag,
            options: REASON_OPTIONS,
            value: reasonFilter,
            onChange: setReasonFilter,
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
