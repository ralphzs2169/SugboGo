import { useState } from "react";
import { getOrdering } from "../../components/data-table/tableUtils";

/**
 * Manages reusable table UI state for the Cluster/Category management screen.
 *
 * Handles:
 * - Search
 * - Sorting
 * - Pagination
 * - Filter reset
 * - API query parameter generation
 *
 * @param {string} currentTab - Active table tab.
 */
export default function useClusterCategoryTableState(currentTab) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Converts table state into API query parameters.
  const params = {
    search: globalFilter,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
    ordering: getOrdering(sorting),

    ...(currentTab === "categories" ? {
      cluster_id: columnFilters.find(
        (filter) => filter.id === "cluster_id",
      )?.value || undefined,
    } : {}),
  };

  const hasActiveFilters =
    globalFilter.trim() !== "" ||
    columnFilters.length > 0 ||
    sorting.length > 0;

  function handleResetFilters() {
    setGlobalFilter("");
    setSorting([]);
    setColumnFilters([]);
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }

  function handleSearchChange(value) {
    setGlobalFilter(value);
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }

  function handleSortingChange(value) {
    setSorting(value);
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }

  return {
    globalFilter,
    setGlobalFilter: handleSearchChange,

    sorting,
    setSorting: handleSortingChange,

    columnFilters,
    setColumnFilters,

    pagination,
    setPagination,

    params,
    hasActiveFilters,

    handleResetFilters,
  };
}
