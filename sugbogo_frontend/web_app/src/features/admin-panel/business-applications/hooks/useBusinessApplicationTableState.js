import { useSearchParams } from "react-router-dom";
import useTableState from "@/shared/hooks/useTableState";

/**
 * Manages table state and API query parameters for business application management.
 *
 * Adds status, queue-status, cluster, and category filtering
 * on top of the shared URL-synced search, sorting, and pagination logic.
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
    updateSearchParams,
  } = useTableState({ defaultTab: "applications" });

  const [searchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") || "";

  const queueStatusFilter = searchParams.get("queue_status") || "";

  const clusterFilter = searchParams.get("cluster") || "";

  const categoryFilter = searchParams.get("category") || "";

  function setStatusFilter(status) {
    updateSearchParams({ status: status || null, page: null });
  }

  function setQueueStatusFilter(queueStatus) {
    updateSearchParams({ queue_status: queueStatus || null, page: null });
  }

  function setReviewQueueFilter(queueStatus) {
    updateSearchParams({
      status: "submitted",
      queue_status: queueStatus || null,
      page: null,
    });
  }

  function setClusterFilter(value) {
    updateSearchParams({ cluster: value || null, page: null });
  }

  function setCategoryFilter(value) {
    updateSearchParams({ category: value || null, page: null });
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    status: statusFilter || undefined,
    queue_status: queueStatusFilter || undefined,
    cluster: clusterFilter || undefined,
    category: categoryFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter ||
    statusFilter ||
    queueStatusFilter ||
    clusterFilter ||
    categoryFilter ||
    sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");

    updateSearchParams({
      search: null,
      status: null,
      queue_status: null,
      cluster: null,
      category: null,
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
    setReviewQueueFilter,

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
  };
}
