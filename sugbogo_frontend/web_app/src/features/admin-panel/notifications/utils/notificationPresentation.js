/** Format compact elapsed time while preserving an explicit unknown-date fallback. */
export function formatNotificationTime(value, now = Date.now()) {
  if (!value) return "Time unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Time unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, duration] of [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]) {
    if (seconds >= duration) return formatter.format(-Math.floor(seconds / duration), unit);
  }
}
