import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getDirectJourneyMap } from "../api/directJourney.service";

export const DIRECT_JOURNEY_MAP_QUERY_KEY = [
  "direct-journey-map",
] as const;

export function directJourneyMapQueryKey(
  businessId: number,
  routeVariantId: number,
  boardingTransitPointId: number,
  alightingTransitPointId: number,
) {
  return [
    ...DIRECT_JOURNEY_MAP_QUERY_KEY,
    businessId,
    routeVariantId,
    boardingTransitPointId,
    alightingTransitPointId,
  ] as const;
}

/** Loads map guidance only for the direct journey selected by the Explorer. */
export default function useDirectJourneyMap(
  businessId: number,
  routeVariantId: number,
  boardingTransitPointId: number,
  alightingTransitPointId: number,
) {
  const hasValidIdentifiers =
    businessId > 0 &&
    routeVariantId > 0 &&
    boardingTransitPointId > 0 &&
    alightingTransitPointId > 0;

  const query = useQuery({
    queryKey: directJourneyMapQueryKey(
      businessId,
      routeVariantId,
      boardingTransitPointId,
      alightingTransitPointId,
    ),
    queryFn: async () => {
      if (!hasValidIdentifiers) {
        throw new Error("Direct journey map identifiers are unavailable.");
      }

      const response = await getDirectJourneyMap(
        businessId,
        routeVariantId,
        boardingTransitPointId,
        alightingTransitPointId,
      );

      return throwOnApiError(response);
    },
    enabled: hasValidIdentifiers,
  });

  return {
    result: query.data ?? null,
    journey: query.data?.journey ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
