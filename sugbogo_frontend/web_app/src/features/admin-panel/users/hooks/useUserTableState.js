import { useState } from "react";

import useTableState from "@/shared/hooks/useTableState";

export default function useUserTableState() {
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

  const searchParams = new URLSearchParams(window.location.search);
  const [roleFilter, setRoleFilterState] = useState(
    () => searchParams.get("role") || "",
  );
  const [statusFilter, setStatusFilterState] = useState(
    () => searchParams.get("status") || "",
  );

  function setRoleFilter(role) {
    setRoleFilterState(role);
    updateSearchParams({ role: role || null, page: null });
    resetPageIndex();
  }

  function setStatusFilter(status) {
    setStatusFilterState(status);
    updateSearchParams({ status: status || null, page: null });
    resetPageIndex();
  }

  const params = {
    search: debouncedGlobalFilter || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    ordering,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(
    globalFilter || roleFilter || statusFilter || sorting.length,
  );

  function handleResetFilters() {
    setGlobalFilter("");
    setRoleFilterState("");
    setStatusFilterState("");
    setSorting([]);
    resetPageIndex();
    updateSearchParams({
      search: null,
      role: null,
      status: null,
      sort: null,
      page: null,
    });
  }

  return {
    globalFilter,
    setGlobalFilter,
    isSearching,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  };
}
