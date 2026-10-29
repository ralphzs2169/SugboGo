import { formatCount, formatDate } from "./presentation";

const day = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
});

export function growthPeriodLabel(start, endExclusive, compact = false) {
  if (!start || !endExclusive) return "Unavailable";
  const first = new Date(start);
  const last = new Date(Date.parse(endExclusive) - 1);
  if (compact) return day.formatRange(first, last);
  return `${day.format(first)} – ${day.format(last)}`;
}

export function growthBucketLabel(row) {
  if (!row?.start || !row?.end_exclusive) return formatDate(row?.date);
  return `${formatDate(row.start)} – ${formatDate(Date.parse(row.end_exclusive) - 1)}`;
}

export function growthComparison(activity) {
  const previous = `Previous ${formatCount(activity?.previous_value)}`;
  const change = activity?.change;
  if (change?.value == null) return `${previous} · Comparison unavailable`;
  if (change.direction === "unchanged") return `${previous} · No change`;
  const arrow = change.direction === "up" ? "↑" : "↓";
  return `${previous} · ${arrow} ${formatCount(Math.abs(change.value))}`;
}

export function growthWeekInProgress(report, interval) {
  const last = report?.series?.at(-1);
  if (interval !== "weekly" || !last?.date || !last.end_exclusive || !report?.meta?.generated_at) return null;
  // Bucket dates are backend-provided Manila week starts. A clipped historical
  // selection is not a week in progress; only the report's current-time cap is.
  const calendarEnd = Date.parse(`${last.date}T00:00:00+08:00`) + 7 * 24 * 60 * 60 * 1000;
  const end = Date.parse(last.end_exclusive);
  const generated = Date.parse(report.meta.generated_at);
  return end === generated && end < calendarEnd ? last.date : null;
}

/** Explains acquisition coverage from metadata without treating it as event tracking. */
export function growthCoverageDescription(meta) {
  if (!meta?.is_partial) {
    return null;
  }

  const descriptions = {
    current_role_and_retained_rows: "Past counts can change when account roles change or records are removed.",
    recorded_approval_history_only: "Approvals use recorded history only; missing earlier approvals cannot be reconstructed.",
    current_day_incomplete: "Today's reporting period is still in progress.",
    data_lag: "Confirmed data does not yet cover the end of the selected period.",
    coverage_unverified: "Complete reporting coverage has not been confirmed.",
    freshness_unverified: "The latest confirmed data time is unavailable.",
    source_partial: "The source supplied limited data.",
    source_unavailable: "The data source is unavailable; this does not mean there was no activity.",
  };
  const reasons = meta.partial_reasons ?? [];
  const notes = reasons.map((reason) => descriptions[reason]).filter(Boolean);

  if (!notes.length || reasons.some((reason) => !descriptions[reason])) {
    notes.push("See About Platform Growth for additional reporting limitations.");
  }

  return notes.join(" ");
}
