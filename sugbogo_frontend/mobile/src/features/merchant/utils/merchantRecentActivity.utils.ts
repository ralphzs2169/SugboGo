import type { MerchantRecentActivityItem } from "../types/merchantRecentActivity.types";

const MANILA = "Asia/Manila";
const DAY_MS = 86_400_000;

/** Returns a Manila calendar key regardless of the device's timezone. */
function manilaDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** Labels a daily activity bucket in the business's Manila timezone. */
function dayLabel(day: string, now: Date) {
  const today = manilaDay(now);
  const difference =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) /
    DAY_MS;
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  const date = new Date(`${day}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: MANILA,
    month: "short",
    day: "numeric",
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

/** Uses daily labels for save summaries and relative times for individual public activity. */
export function formatRecentActivityTime(
  item: MerchantRecentActivityItem,
  now = new Date(),
) {
  if (item.type === "save") return dayLabel(item.date, now);
  const occurredAt = new Date(item.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) return dayLabel(item.date, now);
  const minutes = Math.floor(
    Math.max(0, now.getTime() - occurredAt.getTime()) / 60_000,
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return dayLabel(item.date, now);
}

/** Allows navigation only to valid review targets, leaving vouches and saves informational. */
export function recentActivityReviewId(item: MerchantRecentActivityItem) {
  if (
    item.type !== "review" ||
    item.target?.type !== "business_review" ||
    !Number.isSafeInteger(item.target.id) ||
    item.target.id <= 0
  ) {
    return null;
  }
  return item.target.id;
}
