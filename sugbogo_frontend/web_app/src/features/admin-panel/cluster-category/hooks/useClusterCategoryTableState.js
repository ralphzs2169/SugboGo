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
  // Converts table state into API query parameters.
  const params = {
    search: globalFilter,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
    ordering: getOrdering(sorting),

    cluster_id:
      columnFilters.find((filter) => filter.id === "cluster_id")?.value ?? "",
  };

  console.log("TABLE PARAMS:", params);

  const hasActiveFilters =
    globalFilter.trim() !== "" ||
    columnFilters.length > 0 ||
    sorting.length > 0;

  function handleResetFilters() {
    setGlobalFilter("");
    setSorting([]);
    setColumnFilters([]);
  }

  return {
    globalFilter,
    setGlobalFilter,

    sorting,
    setSorting,

    columnFilters,
    setColumnFilters,

    pagination,
    setPagination,

    params,
    hasActiveFilters,

    handleResetFilters,
  };
}
