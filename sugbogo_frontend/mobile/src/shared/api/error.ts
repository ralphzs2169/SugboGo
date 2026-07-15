/**
 * Extracts a human-readable error message from a Django REST Framework
 * validation response.
 *
 * @param data - The error response returned by the backend.
 * @returns The first available validation message.
 */
export function getApiErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Something went wrong.";
  }

  if (
    "detail" in data &&
    typeof (data as { detail: unknown }).detail === "string"
  ) {
    return (data as { detail: string }).detail;
  }

  for (const value of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }

    if (typeof value === "string") {
      return value;
    }
  }

  return "Something went wrong.";
}
