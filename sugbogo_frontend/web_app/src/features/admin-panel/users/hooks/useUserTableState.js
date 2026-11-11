import { useSearchParams } from "react-router-dom";

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
    updateSearchParams,
  } = useTableState();

  const [searchParams] = useSearchParams();
  const roleFilter = searchParams.get("role") || "";
  const statusFilter = searchParams.get("status") || "";

  function setRoleFilter(role) {
    updateSearchParams({ role: role || null, page: null });
  }

  function setStatusFilter(status) {
    updateSearchParams({ status: status || null, page: null });
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
