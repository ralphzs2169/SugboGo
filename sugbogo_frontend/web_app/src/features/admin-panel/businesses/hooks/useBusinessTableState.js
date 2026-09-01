import { useState } from "react";
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
    resetPageIndex,
    updateSearchParams,
  } = useTableState({ defaultTab: "businesses" });

  const [statusFilter, setStatusFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("status") || "",
  );

  const [clusterFilter, setClusterFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("cluster") || "",
  );
  const [categoryFilter, setCategoryFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("category") || "",
  );
  const [specialtyTagFilter, setSpecialtyTagFilterState] = useState(
    () =>
      new URLSearchParams(window.location.search).get("specialty_tag") || "",
  );

  function setStatusFilter(status) {
    setStatusFilterState(status);
    updateSearchParams({ status: status || null, page: null });
    resetPageIndex();
  }

  function setClusterFilter(value) {
    setClusterFilterState(value);
    updateSearchParams({ cluster: value || null, page: null });
    resetPageIndex();
  }

  function setCategoryFilter(value) {
    setCategoryFilterState(value);
    updateSearchParams({ category: value || null, page: null });
    resetPageIndex();
  }

  function setSpecialtyTagFilter(value) {
    setSpecialtyTagFilterState(value);
    updateSearchParams({ specialty_tag: value || null, page: null });
    resetPageIndex();
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
    setStatusFilterState("");
    setClusterFilterState("");
    setCategoryFilterState("");
    setSpecialtyTagFilterState("");
    setSorting([]);
    resetPageIndex();

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
