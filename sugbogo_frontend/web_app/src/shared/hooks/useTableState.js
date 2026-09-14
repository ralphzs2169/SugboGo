import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";
import useDebounce from "@/shared/hooks/useDebounce";

const DEFAULT_PAGE_SIZE = 10;

function parseSorting(sortParam) {
  if (!sortParam) return [];
  const desc = sortParam.startsWith("-");
  const id = desc ? sortParam.slice(1) : sortParam;
  return [{ id, desc }];
}

function serializeSorting(sorting) {
  if (!sorting || sorting.length === 0) return null;
  const [{ id, desc }] = sorting;
  return desc ? `-${id}` : id;
}

/**
 * Generic URL-synced table state for any DataTable consumer.
 *
 * Handles global search (debounced), sorting, and pagination, syncing
 * each to the URL so filtered/sorted views are shareable and survive
 * navigating away (e.g. to a detail page) and back.
 *
 * Feature-specific filters (status, category, etc.) are NOT handled
 * here — compose them in a feature-level wrapper hook that also calls
 * updateSearchParams for its own filter keys. See useBusinessTableState
 * for an example.
 */
export default function useTableState({
  tabParamKey = "tab",
  defaultTab,
  pageSize = DEFAULT_PAGE_SIZE,
  debounceMs = 400,
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get(tabParamKey) || defaultTab;

  const [globalFilter, setGlobalFilter] = useState(
    () => searchParams.get("search") || "",
  );

  const [sorting, setSortingState] = useState(() =>
    parseSorting(searchParams.get("sort")),
  );

  const [pagination, setPaginationState] = useState(() => ({
    pageIndex: Math.max(0, Number(searchParams.get("page") || 1) - 1),
    pageSize,
  }));

  const debouncedGlobalFilter = useDebounce(globalFilter, debounceMs);
  const isSearching = globalFilter !== debouncedGlobalFilter;

  // Skips the search-sync effect on mount so returning to this page
  // (e.g. from a detail page) doesn't reset pagination back to page 1.
  const isFirstRender = useRef(true);

  function updateSearchParams(updates, { replace = true } = {}) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });

        return next;
      },
      { replace },
    );
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    updateSearchParams({ search: debouncedGlobalFilter || null, page: null });
    setPaginationState((previous) => ({ ...previous, pageIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedGlobalFilter]);

  function setCurrentTab(tab, options) {
    updateSearchParams(
      { [tabParamKey]: tab === defaultTab ? null : tab },
      options,
    );
  }

  function setSorting(updaterOrValue) {
    const next =
      typeof updaterOrValue === "function"
        ? updaterOrValue(sorting)
        : updaterOrValue;

    setSortingState(next);
    updateSearchParams({
      sort: serializeSorting(next),
    });
  }

  function resetSortingState() {
    setSortingState([]);
  }

  function setPagination(updaterOrValue) {
    const next =
      typeof updaterOrValue === "function"
        ? updaterOrValue(pagination)
        : updaterOrValue;

    setPaginationState(next);
    updateSearchParams({
      page: next.pageIndex > 0 ? String(next.pageIndex + 1) : null,
    });
  }

  function resetPageIndex() {
    setPaginationState((previous) => ({ ...previous, pageIndex: 0 }));
  }

  const ordering = useMemo(() => getOrdering(sorting), [sorting]);

  return {
    currentTab,
    setCurrentTab,

    globalFilter,
    setGlobalFilter,
    debouncedGlobalFilter,
    isSearching,

    sorting,
    setSorting,
    resetSortingState,
    ordering,

    pagination,
    setPagination,
    resetPageIndex,

    updateSearchParams,
  };
}
