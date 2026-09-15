import { useState } from "react";

import useTableState from "@/shared/hooks/useTableState";

const VALID_TABS = new Set(["routes", "transit-points", "transfers"]);

export default function useTransitTableState() {
  const tableState = useTableState({ defaultTab: "routes" });
  const currentTab = VALID_TABS.has(tableState.currentTab)
    ? tableState.currentTab
    : "routes";
  const [statusFilter, setStatusFilterState] = useState(
    () => new URLSearchParams(window.location.search).get("status") || "",
  );

  function setStatusFilter(status) {
    setStatusFilterState(status);
    tableState.updateSearchParams({ status: status || null, page: null });
    tableState.resetPageIndex();
  }

  function handleTabChange(tab) {
    tableState.setGlobalFilter("");
    tableState.resetSortingState();
    setStatusFilterState("");
    tableState.resetPageIndex();
    tableState.updateSearchParams(
      {
        tab: tab === "routes" ? null : tab,
        search: null,
        status: null,
        sort: null,
        page: null,
      },
      { replace: false },
    );
  }

  function handleResetFilters() {
    tableState.setGlobalFilter("");
    tableState.resetSortingState();
    setStatusFilterState("");
    tableState.resetPageIndex();
    tableState.updateSearchParams({
      search: null,
      status: null,
      sort: null,
      page: null,
    });
  }

  const commonParams = {
    page: tableState.pagination.pageIndex + 1,
    page_size: tableState.pagination.pageSize,
    ordering: tableState.ordering || undefined,
  };

  return {
    ...tableState,
    currentTab,
    statusFilter,
    setStatusFilter,
    handleTabChange,
    handleResetFilters,
    routeParams: {
      ...commonParams,
      search: tableState.debouncedGlobalFilter || undefined,
    },
    pointParams: {
      ...commonParams,
      search: tableState.debouncedGlobalFilter || undefined,
    },
    transferParams: {
      ...commonParams,
      status: statusFilter || undefined,
    },
    hasActiveFilters: Boolean(
      tableState.globalFilter ||
        statusFilter ||
        tableState.sorting.length,
    ),
  };
}
