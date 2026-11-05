import { formatDate } from "@/shared/utils/dateUtils";

const joinedTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

const reputationFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
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

/** Formats user activity and account timestamps explicitly in Philippine Time. */
export function formatUserDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "—";
  }

  return `${dateTimeFormatter.format(new Date(value))} · PHT`;
}

/** Shows the stored reputation score on its authoritative zero-to-one scale. */
export function formatUserReputation(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const score = Number(value);

  if (!Number.isFinite(score) || score < 0 || score > 1) {
    return "—";
  }

  return `${reputationFormatter.format(score)} / 1.00`;
}
