import { useMutation } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  getExperimentalItinerary,
  searchExperimentalItineraries,
} from "../api/experimentalItinerary.service";
import type { ItineraryCoordinate, TransferLimit } from "../types/experimentalItinerary.types";

/** Evaluate itineraries only on explicit actions and retain results in screen memory. */
export default function useExperimentalItinerary(businessId: number) {
  const search = useMutation({
    gcTime: 0,
    retry: false,
    networkMode: "always",
    mutationFn: async ({
      origin,
      maxTransfers,
    }: {
      origin: ItineraryCoordinate;
      maxTransfers: TransferLimit;
      originType: "selected" | "current";
    }) => throwOnApiError(await searchExperimentalItineraries(businessId, origin, maxTransfers)),
  });
  const detail = useMutation({
    gcTime: 0,
    retry: false,
    networkMode: "always",
    mutationFn: async (selection: string) =>
      throwOnApiError(await getExperimentalItinerary(businessId, selection)),
  });
  return { search, detail };
}
