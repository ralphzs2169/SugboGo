import { formatDate } from "@/shared/utils/dateUtils";

const joinedTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

/** Displays account registration dates in Philippine Time on every device. */
export function formatUserJoinedDate(value) {
  if (!value) {
    return "—";
  }

  return formatDate(value, {
    timeZone: "Asia/Manila",
  });
}

/** Displays account registration times in Philippine Time. */
export function formatUserJoinedTime(value) {
  if (!value) {
    return "—";
  }

  return joinedTimeFormatter.format(new Date(value));
}
