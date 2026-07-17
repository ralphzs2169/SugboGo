import { ApiError } from "./types";

/**
 * Retrieves the first validation error message for a specific field from an
 * API error response.
 *
 * @param error - The API error response.
 * @param field - The name of the field for which to retrieve the error message.
 * @returns The first validation error message for the specified field, or undefined if no error exists.
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
