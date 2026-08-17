import { useState } from "react";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";

/**
 * Manages table state and API query parameters for business management.
 *
 * Handles global search, status filtering, sorting, pagination,
 * and resetting the table to its default state.
 */
export default function useBusinessTableState() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [sorting, setSorting] = useState([]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  function setStatusFilter(status) {
    setStatusFilterState(status);

    setPagination((previous) => ({
      ...previous,
      pageIndex: 0,
    }));
  }

  const params = {
    search: globalFilter || undefined,
    status: statusFilter || undefined,
    ordering: getOrdering(sorting),
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

    setPagination((previous) => ({
      ...previous,
      pageIndex: 0,
    }));
  }

  return {
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
  };
}
