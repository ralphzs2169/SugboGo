import { useState } from "react";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";

export default function useSpecialtyTagTableState() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const params = {
    search: globalFilter || undefined,
    ordering: getOrdering(sorting),
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const hasActiveFilters = Boolean(globalFilter || sorting.length);

  function handleResetFilters() {
    setGlobalFilter("");
    setSorting([]);
    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }));
  }

  return {
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  };
}
