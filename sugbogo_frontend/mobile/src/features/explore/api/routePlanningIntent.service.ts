import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  NavigationMethod,
  RoutePlanningIntentResult,
} from "../types/routePlanningIntent.types";

/** Sends only the business and method; the server supplies identity and time. */
export function recordRoutePlanningIntent(
  businessId: number,
  navigationMethod: NavigationMethod,
): Promise<ApiResponse<RoutePlanningIntentResult>> {
  return request(
    apiClient.post(`/explorer/explore/businesses/${businessId}/route-intent/`, {
      navigation_method: navigationMethod,
    }),
  );
}
