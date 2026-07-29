/**
 * Formats an ISO date string into a readable dashboard date.
 *
 * @param {string|null} value - ISO date string from API.
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats an ISO date string with date and time.
 *
 * @param {string|null} value - ISO date string from API.
 * @returns {string}
 */
export function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
