import { useState } from "react";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";

/**
 * Manages table state and API query parameters for business application management.
 *
 * Handles global search, status filtering, sorting, pagination, and
 * resetting the table to its default state.
 */
export default function useBusinessApplicationTableState() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sorting, setSorting] = useState([]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

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

  // Resets search, status, and sorting filters and returns to the first page.
  function handleResetFilters() {
    setGlobalFilter("");
    setStatusFilter("");
    setSorting([]);

    setPagination((prev) => ({
      ...prev,
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
