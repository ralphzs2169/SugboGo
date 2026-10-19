import { isAxiosError } from "axios";
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
    apiClient
      .post(`/explorer/explore/businesses/${businessId}/route-intent/`, {
        navigation_method: navigationMethod,
      })
      .then(
        (response) => {
          if (__DEV__) {
            console.debug("[route-intent] HTTP response", {
              method: navigationMethod,
              status: response.status,
            });
          }
          return response;
        },
        (error: unknown) => {
          if (__DEV__) {
            console.warn("[route-intent] HTTP request failed", {
              method: navigationMethod,
              status: isAxiosError(error) ? error.response?.status : undefined,
            });
          }
          // Let the shared wrapper retain its existing error-envelope behavior.
          throw error;
        },
      ),
  );
}
