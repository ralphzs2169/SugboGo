import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  ItineraryCoordinate,
  ItineraryDetail,
  ItinerarySearchResult,
  TransferLimit,
} from "../types/experimentalItinerary.types";

const EVALUATION_TIMEOUT_MS = 35_000;

export function searchExperimentalItineraries(
  businessId: number,
  origin: ItineraryCoordinate,
  maxTransfers: TransferLimit,
): Promise<ApiResponse<ItinerarySearchResult>> {
  return request(
    apiClient.post(
      `/explorer/explore/businesses/${businessId}/itineraries/v1/search/`,
      { ...origin, max_transfers: maxTransfers },
      { timeout: EVALUATION_TIMEOUT_MS },
    ),
  );
}

export function getExperimentalItinerary(
  businessId: number,
  selection: string,
): Promise<ApiResponse<ItineraryDetail>> {
  return request(
    apiClient.post(
      `/explorer/explore/businesses/${businessId}/itineraries/v1/detail/`,
      { selection },
      { timeout: EVALUATION_TIMEOUT_MS },
    ),
  );
}
