import { formatRelativeDate } from "@/shared/utils/dateUtils";

export function formatReviewTimestamp(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  const day = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${day} · ${time}`;
}

export function formatModerationQueueTime(value, now = Date.now()) {
  if (!value) {
    return "Unknown date";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60000),
  );

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  return formatRelativeDate(value);
}
