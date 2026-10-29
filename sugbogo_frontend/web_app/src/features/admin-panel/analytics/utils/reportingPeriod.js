export const ANALYTICS_PERIODS = ["7", "30", "90", "custom"];
export const DEFAULT_ANALYTICS_PERIOD = "30";

/** Calendar dates stay calendar dates; the API owns Manila boundaries and comparisons. */
export function serializeReportingPeriod({
  period = DEFAULT_ANALYTICS_PERIOD,
  start_date,
  end_date,
} = {}) {
  const selected = String(period);
  if (!ANALYTICS_PERIODS.includes(selected)) {
    throw new RangeError("Unsupported analytics period.");
  }
  if (selected !== "custom") {
    return { period: selected };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date ?? "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end_date ?? "")
  ) {
    throw new RangeError("Custom analytics periods require start_date and end_date as YYYY-MM-DD.");
  }
  return { period: selected, start_date, end_date };
}
