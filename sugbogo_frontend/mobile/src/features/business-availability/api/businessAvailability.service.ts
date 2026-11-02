import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

export type AvailabilityResponse = {
  checked_at: string;
  items: { business_id: number; availability: "available" | "unavailable" }[];
};

/** Check bounded saved identities without retrieving restricted business profiles. */
export function getBusinessAvailability(
  ids: number[],
  signal?: AbortSignal,
): Promise<ApiResponse<AvailabilityResponse>> {
  return request(
    apiClient.post(
      "/explorer/explore/businesses/availability/",
      { business_ids: ids },
      { signal },
    ),
  );
}
