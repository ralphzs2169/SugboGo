import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMapDirectoryPage } from "../api/mapDiscovery.service";
import type {
  MapDiscoveryBusiness,
  MapDiscoveryFilters,
} from "../types/mapDiscovery.types";

export const MAP_DIRECTORY_QUERY_KEY = ["map-discovery-directory"] as const;
const DIRECTORY_KEY = [...MAP_DIRECTORY_QUERY_KEY, "all"] as const;
const OPEN_NOW_KEY = [...MAP_DIRECTORY_QUERY_KEY, "open-now"] as const;
const EMPTY_BUSINESSES: MapDiscoveryBusiness[] = [];

/** Accumulates a complete snapshot; failed or cancelled pages never replace cached data. */
async function loadDirectory(
  signal: AbortSignal,
  options: { openNow?: boolean; businessId?: number } = {},
) {
  const businesses = new Map<number, MapDiscoveryBusiness>();
  let page = 1;
  let expectedTotal: number | undefined;
  while (true) {
    if (signal.aborted) {
      throw new Error("Directory loading cancelled.");
    }
    const data = throwOnApiError(
      await getMapDirectoryPage(page, signal, options),
    );
    const pagination = data.pagination;
    expectedTotal ??= pagination.total_items;
    if (
      pagination.page !== page ||
      pagination.total_items !== expectedTotal ||
      (pagination.has_next &&
        (data.items.length === 0 || page >= pagination.total_pages))
    ) {
      throw new Error(
        "The business directory changed while loading. Please retry.",
      );
    }
    for (const business of data.items) {
      businesses.set(business.id, business);
    }
    if (!pagination.has_next) {
      if (businesses.size !== expectedTotal) {
        throw new Error("The business directory is incomplete. Please retry.");
      }
      return [...businesses.values()];
    }
    page += 1;
  }
}

/** Matches Explore's category OR and cross-filter AND semantics using active labels. */
export function matchesMapFilters(
  business: MapDiscoveryBusiness,
  filters: MapDiscoveryFilters,
) {
  return (
    (filters.clusterId === null ||
      business.cluster?.id === filters.clusterId) &&
    (filters.categoryIds.length === 0 ||
      filters.categoryIds.includes(business.category?.id)) &&
    (filters.specialtyTagId === null ||
      business.specialty_tags?.some(
        (tag) => tag.id === filters.specialtyTagId,
      )) &&
    (!filters.hiddenGems || business.is_hidden_gem === true)
  );
}

/** Caches complete directory snapshots and server-calculated Open Now IDs, never camera state. */
export default function useMapDirectory(
  filters: MapDiscoveryFilters,
  searchBusinessId?: number,
) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const isActive = isFocused && (appState === null || appState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!isActive) {
      void queryClient.cancelQueries({ queryKey: MAP_DIRECTORY_QUERY_KEY });
    } else if (!filters.openNow) {
      void queryClient.cancelQueries({ queryKey: OPEN_NOW_KEY });
    }
  }, [isActive, filters.openNow, queryClient]);

  const directory = useQuery({
    queryKey: DIRECTORY_KEY,
    queryFn: ({ signal }) => loadDirectory(signal),
    enabled: isActive,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const openNow = useQuery({
    queryKey: OPEN_NOW_KEY,
    queryFn: async ({ signal }) =>
      (await loadDirectory(signal, { openNow: true })).map(
        (business) => business.id,
      ),
    enabled: isActive && filters.openNow,
    staleTime: 30_000,
    refetchInterval: (query) =>
      isActive && filters.openNow && query.state.status !== "error"
        ? 60_000
        : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const allBusinesses = directory.data ?? EMPTY_BUSINESSES;
  const cachedSelection = allBusinesses.find(
    (business) => business.id === searchBusinessId,
  );
  const selection = useQuery({
    queryKey: [...MAP_DIRECTORY_QUERY_KEY, "business", searchBusinessId],
    queryFn: ({ signal }) =>
      loadDirectory(signal, { businessId: searchBusinessId }),
    enabled:
      isActive &&
      searchBusinessId !== undefined &&
      !directory.isPending &&
      !cachedSelection,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const businesses = useMemo(() => {
    const eligibleIds = new Set(openNow.data ?? []);
    return allBusinesses.filter(
      (business) =>
        matchesMapFilters(business, filters) &&
        (!filters.openNow || eligibleIds.has(business.id)),
    );
  }, [allBusinesses, filters, openNow.data]);

  return {
    businesses,
    allBusinesses,
    isLoading: directory.isPending,
    isFetching: directory.isFetching,
    error: directory.error,
    refetch: directory.refetch,
    openNowError: filters.openNow ? openNow.error : null,
    isLoadingOpenNow: filters.openNow && openNow.isPending,
    refetchOpenNow: openNow.refetch,
    selectedSearchBusiness: cachedSelection ?? selection.data?.[0],
    isLoadingSelection:
      searchBusinessId !== undefined &&
      !cachedSelection &&
      (directory.isPending || selection.isFetching),
    selectionResolved: Boolean(cachedSelection) || selection.isSuccess,
    selectionError: cachedSelection ? null : selection.error,
    refetchSelection: selection.refetch,
  };
}
