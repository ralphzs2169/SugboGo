import { ApiError } from "./types";

import Toast from "react-native-toast-message";
import { ApiResponse } from "@/shared/api/types";
import { API_ERROR_MESSAGE } from "./errorMessages";

/**
 * Shared API error identifiers used throughout the networking layer.
 *
 * Network interceptors throw plain Error objects whose `name` identifies
 * the type of failure (e.g. network unavailable or request timeout).
 * The request wrapper (request.ts) inspects `error.name` to normalize
 * these failures into the application's standard API response format.
 */

/**
 * Creates an API error identified by its `name`.
 *
 * The networking layer uses `error.name` as the canonical identifier
 * for transport-level failures. The error message is intentionally not
 * user-facing; request.ts converts these errors into standardized
 * API responses with messages from `API_ERROR_MESSAGES`.
 *
 * @param name - The API error identifier.
 * @returns A tagged Error instance.
 */
export function createApiError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

/**
 * Retrieves the first validation error message for a specific field from an
 * API error response.
 */
export function getFieldError(
  error: ApiError,
  field: string,
): string | undefined {
  const value = error.errors?.[field];

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

/**
 * This helper only handles errors outside the user's control, such as
 * network failures, request timeouts, and unexpected server errors.
 * Validation errors and feature-specific responses (e.g. invalid
 * credentials or unverified email) should be handled by the caller.
 *
 * The response is expected to have already been normalized by
 * request.ts. User-facing messages are retrieved from
 * `API_ERROR_MESSAGES`, keeping all default system error text in a
 * single location.
 *
 * @param response - The standardized API response.
 * @returns True if a system error was handled; otherwise false.
 */
export function handleSystemError(response: ApiResponse<any>) {
  if (response.success) {
    return false;
  }

  const message =
    API_ERROR_MESSAGE[response.code as keyof typeof API_ERROR_MESSAGE];

  if (!message) {
    return false;
  }

  Toast.show({
    type: "error",
    text1: message,
  });

  return true;
}
