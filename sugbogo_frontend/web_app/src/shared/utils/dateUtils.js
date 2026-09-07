/**
 * Formats an ISO date string into a readable dashboard date.
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

/**
 * Formats a date as a relative number of days from today.
 */
/**
 * Formats a date as a relative number of calendar days from today.
 */
export function formatRelativeDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  const today = new Date();

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const todayDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const days = Math.max(0, Math.round((todayDay - dateDay) / 86400000));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  return `${days} days ago`;
}
