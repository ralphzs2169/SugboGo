import { ApiError } from "./types";

import Toast from "react-native-toast-message";
import { ApiResponse } from "@/shared/api/types";

/**
 * Shared error "tags" used to pass information from the Axios interceptor
 * (client.ts) to the request wrapper (request.ts).
 *
 * Why this file exists: once the interceptor catches a network/timeout
 * error, it converts it into a plain `Error` object.
 * At that point `axios.isAxiosError()` no longer returns true for it, so
 * request.ts has to identify it some other way — by `error.name`.
 * Both files import these constants so the names can never drift apart.
 */
export const API_ERROR_NAMES = {
  AUTH_ERROR: "AUTH_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
} as const;

/** Creates a tagged Error consistently, so .name and .message never mismatch. */
export function createTaggedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * Retrieves the first validation error message for a specific field from an
 * API error response.
 *
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
 * Handles system-level API errors by displaying a toast notification.
 *
 * This helper only handles errors that are outside the user's control,
 * such as network failures, request timeouts, and unexpected server issues.
 * Feature-specific errors (e.g. invalid credentials or unverified email)
 * should be handled by the calling screen.
 *
 * @template T - The expected API response data type.
 * @param response - The standardized API response returned from a request.
 * @returns True if the error was handled, otherwise false.
 */
export function handleSystemError(response: ApiResponse<any>) {
  if (response.success) {
    return false;
  }

  if (
    response.code === "UNKNOWN_ERROR" ||
    response.code === "NETWORK_ERROR" ||
    response.code === "REQUEST_TIMEOUT"
  ) {
    Toast.show({
      type: "error",
      text1: "Something went wrong. Please try again.",
    });

    return true;
  }

  return false;
}
