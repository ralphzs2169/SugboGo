import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";

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

  const location = useLocation();
  const urlSearch = searchParams.get("search") || "";
  const [draft, setDraft] = useState(null);
  const globalFilter = draft?.key === location.key ? draft.value : urlSearch;
  const debouncedGlobalFilter = urlSearch;
  const isSearching = globalFilter !== urlSearch;
  const sortParam = searchParams.get("sort");
  const sorting = useMemo(() => parseSorting(sortParam), [sortParam]);
  const requestedPage = Number(searchParams.get("page") || 1);
  const pagination = {
    pageIndex: Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage - 1
      : 0,
    pageSize,
  };

  function setGlobalFilter(value) {
    setDraft({ key: location.key, value });
  }

  function updateSearchParams(updates, { replace = true } = {}) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace });
    }
  }

  useEffect(() => {
    setDraft((previous) => (
      previous?.key === location.key ? previous : null
    ));
  }, [location.key]);

  // Navigation invalidates a draft and cancels its pending search update.
  useEffect(() => {
    if (!isSearching) return;
    const timer = setTimeout(() => {
      updateSearchParams({ search: globalFilter || null, page: null });
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter, isSearching, location.key, debounceMs]);

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

    updateSearchParams({
      sort: serializeSorting(next),
    });
  }

  function resetSortingState() {
    updateSearchParams({ sort: null });
  }

  function setPagination(updaterOrValue) {
    const next =
      typeof updaterOrValue === "function"
        ? updaterOrValue(pagination)
        : updaterOrValue;

    updateSearchParams({
      page: next.pageIndex > 0 ? String(next.pageIndex + 1) : null,
    });
  }

  function resetPageIndex() {
    updateSearchParams({ page: null });
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
