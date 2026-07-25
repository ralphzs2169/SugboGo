import { ApiError } from "./types";

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
