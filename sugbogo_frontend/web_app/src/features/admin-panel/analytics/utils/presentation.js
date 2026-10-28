const counts = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const timestamps = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export const formatCount = (value) => value == null ? "Unavailable" : counts.format(value);
export const formatPercentage = (value) => value == null ? "Unavailable" : `${counts.format(value)}%`;
export const formatHours = (value) => value == null ? "Unavailable" : `${counts.format(value)} hours`;
export const formatDate = (value) => value == null ? "Unavailable" : dates.format(new Date(value));
export const formatTimestamp = (value) => value == null ? "Unknown" : timestamps.format(new Date(value));

export function comparisonText(change) {
  if (change?.value == null) return "Comparison unavailable";
  const direction = { up: "Increase", down: "Decrease", unchanged: "No change" }[change.direction];
  const suffix = { count: "", percent: "%", percentage_points: " percentage points" }[change.unit] ?? "";
  return `${direction}: ${formatCount(change.value)}${suffix} vs previous period`;
}

export function sectionQueryState(query) {
  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasData: query.data !== undefined,
    error: query.error,
    onRetry: () => query.refetch(),
  };
}
