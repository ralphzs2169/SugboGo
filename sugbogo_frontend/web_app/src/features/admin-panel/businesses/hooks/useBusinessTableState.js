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

  function setStatusFilter(status) {
    setStatusFilterState(status);
    updateSearchParams({ status: status || null, page: null });
    resetPageIndex();
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    status: statusFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter || statusFilter || sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");
    setStatusFilterState("");
    setSorting([]);
    resetPageIndex();
    updateSearchParams({ search: null, status: null, sort: null, page: null });
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
  };
}
