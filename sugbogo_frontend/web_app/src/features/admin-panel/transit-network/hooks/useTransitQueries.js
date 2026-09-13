import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchJeepneyRoute,
  fetchJeepneyRoutes,
  fetchRouteVariants,
  fetchRouteVariant,
  fetchTransitPoint,
  fetchTransitPoints,
  fetchTransitTransfer,
  fetchTransitTransfers,
} from "../services/transitNetworkService";
import { transitQueryKeys } from "./transitQueryKeys";

function usePaginatedTransitQuery({ queryKey, queryFn, enabled = true }) {
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    placeholderData: keepPreviousData,
  });
  const response = query.data;

  return {
    items: response?.items ?? [],
    totalItems: response?.pagination?.total_items ?? 0,
    pageCount: response?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useJeepneyRoutes(params = {}, options = {}) {
  return usePaginatedTransitQuery({
    queryKey: transitQueryKeys.routeList(params),
    queryFn: () => fetchJeepneyRoutes(params),
    enabled: options.enabled,
  });
}

export function useJeepneyRoute(routeId, options = {}) {
  const query = useQuery({
    queryKey: transitQueryKeys.routeDetail(routeId),
    queryFn: () => fetchJeepneyRoute(routeId),
    enabled: options.enabled !== false && Boolean(routeId),
  });

  return {
    route: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRouteVariants(params = {}, options = {}) {
  return usePaginatedTransitQuery({
    queryKey: transitQueryKeys.variantList(params),
    queryFn: () => fetchRouteVariants(params),
    enabled: options.enabled,
  });
}

export function useRouteVariant(variantId, options = {}) {
  const query = useQuery({
    queryKey: transitQueryKeys.variantDetail(variantId),
    queryFn: () => fetchRouteVariant(variantId),
    enabled: options.enabled !== false && Boolean(variantId),
  });

  return {
    variant: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTransitPoints(params = {}, options = {}) {
  return usePaginatedTransitQuery({
    queryKey: transitQueryKeys.transitPointList(params),
    queryFn: () => fetchTransitPoints(params),
    enabled: options.enabled,
  });
}

export function useTransitPoint(transitPointId, options = {}) {
  const query = useQuery({
    queryKey: transitQueryKeys.transitPointDetail(transitPointId),
    queryFn: () => fetchTransitPoint(transitPointId),
    enabled: options.enabled !== false && Boolean(transitPointId),
  });

  return {
    transitPoint: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTransitTransfers(params = {}, options = {}) {
  return usePaginatedTransitQuery({
    queryKey: transitQueryKeys.transferList(params),
    queryFn: () => fetchTransitTransfers(params),
    enabled: options.enabled,
  });
}

export function useTransitTransfer(transferId, options = {}) {
  const query = useQuery({
    queryKey: transitQueryKeys.transferDetail(transferId),
    queryFn: () => fetchTransitTransfer(transferId),
    enabled: options.enabled !== false && Boolean(transferId),
  });

  return {
    transfer: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
