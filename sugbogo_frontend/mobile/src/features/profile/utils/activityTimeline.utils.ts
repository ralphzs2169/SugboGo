/** Creates a local calendar key so date groups match the displayed local time. */
export function activityDayKey(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Labels local calendar days without assuming every day is exactly 24 hours. */
export function activityDayLabel(timestamp: string, now = new Date()) {
  const day = activityDayKey(timestamp);
  if (day === activityDayKey(now.toISOString())) {
    return "Today";
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === activityDayKey(yesterday.toISOString())) {
    return "Yesterday";
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
