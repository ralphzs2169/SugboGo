import { useSearchParams } from "react-router-dom";
import useTableState from "@/shared/hooks/useTableState";

export default function useBusinessTableState() {
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
  } = useTableState({ defaultTab: "businesses" });

  // Observe same-page overview links and browser back/forward navigation.
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const clusterFilter = searchParams.get("cluster") || "";
  const categoryFilter = searchParams.get("category") || "";
  const specialtyTagFilter = searchParams.get("specialty_tag") || "";

  function setStatusFilter(status) {
    updateSearchParams({ status: status || null, page: null });
  }

  function setClusterFilter(value) {
    updateSearchParams({ cluster: value || null, page: null });
  }

  function setCategoryFilter(value) {
    updateSearchParams({ category: value || null, page: null });
  }

  function setSpecialtyTagFilter(value) {
    updateSearchParams({ specialty_tag: value || null, page: null });
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    status: statusFilter || undefined,
    cluster: clusterFilter || undefined,
    category: categoryFilter || undefined,
    specialty_tag: specialtyTagFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter ||
    statusFilter ||
    clusterFilter ||
    categoryFilter ||
    specialtyTagFilter ||
    sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");

    updateSearchParams({
      search: null,
      status: null,
      cluster: null,
      category: null,
      specialty_tag: null,
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
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
    isSearching,
    clusterFilter,
    setClusterFilter,
    categoryFilter,
    setCategoryFilter,
    specialtyTagFilter,
    setSpecialtyTagFilter,
  };
}
