import { useRef } from "react";

import useTableState from "@/shared/hooks/useTableState";

const VALID_TABS = new Set(["routes", "transit-points"]);

export default function useTransitTableState() {
  const tableState = useTableState({ defaultTab: "routes" });
  const currentTab = VALID_TABS.has(tableState.currentTab)
    ? tableState.currentTab
    : "routes";
  const browsingByTab = useRef({});

  function handleTabChange(tab) {
    browsingByTab.current[currentTab] = {
      search: tableState.globalFilter,
      page: tableState.isSearching ? 1 : tableState.pagination.pageIndex + 1,
      sort: tableState.ordering,
    };

    const browsing = browsingByTab.current[tab];
    tableState.updateSearchParams(
      {
        tab: tab === "routes" ? null : tab,
        search: browsing?.search,
        sort: browsing?.sort,
        page: browsing?.page > 1 ? browsing.page : null,
      },
      { replace: false },
    );
  }

  function handleResetFilters() {
    tableState.setGlobalFilter("");
    tableState.resetSortingState();
    tableState.resetPageIndex();
    tableState.updateSearchParams({
      search: null,
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
    hasActiveFilters: Boolean(
      tableState.globalFilter ||
        tableState.sorting.length,
    ),
  };
}
