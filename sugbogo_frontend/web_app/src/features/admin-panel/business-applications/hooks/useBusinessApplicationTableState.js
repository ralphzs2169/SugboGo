import { useState } from "react";
import useTableState from "@/shared/hooks/useTableState";

/**
 * Manages table state and API query parameters for business application management.
 *
 * Adds status and queue-status filtering on top of the shared URL-synced
 * search, sorting, and pagination logic.
 */
export default function useBusinessApplicationTableState() {
  const {
    currentTab,
    setCurrentTab,
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
  } = useTableState({ defaultTab: "applications" });

  const [statusFilter, setStatusFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("status") || "",
  );

  const [queueStatusFilter, setQueueStatusFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("queue_status") || "",
  );

  function setStatusFilter(status) {
    setStatusFilterState(status);
    updateSearchParams({ status: status || null, page: null });
    resetPageIndex();
  }

  function setQueueStatusFilter(queueStatus) {
    setQueueStatusFilterState(queueStatus);
    updateSearchParams({ queue_status: queueStatus || null, page: null });
    resetPageIndex();
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    status: statusFilter || undefined,
    queue_status: queueStatusFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter || statusFilter || queueStatusFilter || sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");
    setStatusFilterState("");
    setQueueStatusFilterState("");
    setSorting([]);
    resetPageIndex();

    updateSearchParams({
      search: null,
      status: null,
      queue_status: null,
      sort: null,
      page: null,
    });
  }

  return {
    currentTab,
    setCurrentTab,

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

    isSearching,
  };
}
