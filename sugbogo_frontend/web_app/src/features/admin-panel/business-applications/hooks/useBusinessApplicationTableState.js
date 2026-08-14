import { useState } from "react";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";

/**
 * Manages table state and API query parameters for business application management.
 *
 * Handles global search, status filtering, queue-status filtering, sorting,
 * pagination, and resetting the table to its default state.
 */
export default function useBusinessApplicationTableState() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [queueStatusFilter, setQueueStatusFilterState] = useState("");
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

  function setQueueStatusFilter(queueStatus) {
    setQueueStatusFilterState(queueStatus);

    setPagination((previous) => ({
      ...previous,
      pageIndex: 0,
    }));
  }

  const params = {
    search: globalFilter || undefined,
    status: statusFilter || undefined,
    queue_status: queueStatusFilter || undefined,
    ordering: getOrdering(sorting),
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

    queueStatusFilter,
    setQueueStatusFilter,

    sorting,
    setSorting,

    pagination,
    setPagination,

    params,

    hasActiveFilters,
    handleResetFilters,
  };
}
