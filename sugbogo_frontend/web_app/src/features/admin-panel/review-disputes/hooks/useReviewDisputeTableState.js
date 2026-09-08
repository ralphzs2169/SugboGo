import { useState } from "react";

import useTableState from "@/shared/hooks/useTableState";

/**
 * Manages URL-synced table state for the review dispute moderation queue.
 *
 * Extends the shared table state with dispute-specific status and reason
 * filters while providing API-ready search, sorting, and pagination params.
 */
export default function useReviewDisputeTableState() {
  const {
    globalFilter,
    setGlobalFilter,
    debouncedGlobalFilter,
    isSearching,
    sorting,
    setSorting,
    ordering,
    pagination,
    setPagination,
    resetPageIndex,
    updateSearchParams,
  } = useTableState();

  const [statusFilter, setStatusFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("status") || "",
  );

  const [reasonFilter, setReasonFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("reason") || "",
  );

  function setStatusFilter(status) {
    setStatusFilterState(status);

    updateSearchParams({
      status: status || null,
      page: null,
    });

    resetPageIndex();
  }

  function setReasonFilter(reason) {
    setReasonFilterState(reason);

    updateSearchParams({
      reason: reason || null,
      page: null,
    });

    resetPageIndex();
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    status: statusFilter || undefined,
    reason: reasonFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter || statusFilter || reasonFilter || sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");
    setStatusFilterState("");
    setReasonFilterState("");
    setSorting([]);
    resetPageIndex();

    updateSearchParams({
      search: null,
      status: null,
      reason: null,
      sort: null,
      page: null,
    });
  }

  return {
    globalFilter,
    setGlobalFilter,
    isSearching,

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
  };
}
