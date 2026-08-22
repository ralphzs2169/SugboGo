import type { ApiResponse } from "@/shared/types/apiResponse.types";

/**
 * Adapts the mobile API response pattern for TanStack Query.
 *
 * Returns successful response data and throws the API response
 * when the request fails, allowing TanStack Query to manage
 * the mutation or query error state.
 */
export function throwOnApiError<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw response;
  }

  return response.data;
}
