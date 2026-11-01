import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatCount } from "../../analytics/utils/presentation";

/** Show reconciled backend weekday counts as an exact proportional distribution, keeping unknown ages separate. */
export default function ApplicationReviewAging({
  aging,
  pendingReview,
  onRetry,
  retrying,
}) {
  const categories = [
    {
      key: "on_time",
      label: "On time",
      days: "0–2 weekdays",
      color: "var(--color-success)",
    },
    {
      key: "approaching",
      label: "Approaching deadline",
      days: "3–4 weekdays",
      color: "var(--color-warning)",
    },
    {
      key: "overdue",
      label: "Overdue",
      days: "5+ weekdays",
      color: "var(--color-danger)",
    },
    {
      key: "unknown_age",
      label: "Unknown age",
      days: "Aging unavailable",
      color: "var(--color-neutral)",
    },
  ].map((row) => ({ ...row, count: aging?.[row.key] }));
  const available =
    Number.isInteger(pendingReview) &&
    pendingReview >= 0 &&
    categories.every((row) => Number.isInteger(row.count) && row.count >= 0) &&
    categories.reduce((sum, row) => sum + row.count, 0) === pendingReview;
  if (!available)
    return (
      <DataErrorState
        compact
        title="Aging distribution unavailable"
        message="Complete, matching queue counts are required. Please try again."
        onRetry={onRetry}
        retrying={retrying}
        retryLabel="Retry"
      />
    );
  const rows = categories.filter(
    (row) => row.key !== "unknown_age" || row.count > 0,
  );
  const applications = pendingReview === 1 ? "application" : "applications";
  const description =
    pendingReview > 0
      ? rows
          .map(
            (row) =>
              `${row.label}: ${formatCount(row.count)} of ${formatCount(pendingReview)} applications (${((row.count / pendingReview) * 100).toFixed(1)}%)`,
          )
          .join("; ")
      : "No applications awaiting review.";
  return (
    <div className="min-w-0">
      {/* The summary and all segments share the same submitted-application inventory. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {formatCount(pendingReview)}
          </span>
          <span className="text-xs text-text-secondary">
            {applications} awaiting review
          </span>
        </p>
        {aging.overdue > 0 && (
          <span className="rounded bg-danger/10 px-2 py-1 text-xs font-medium text-danger">
            {formatCount(aging.overdue)} overdue
          </span>
        )}
      </div>
      {pendingReview > 0 ? (
        <>
          <div
            role="img"
            aria-label={description}
            className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted"
          >
            {rows
              .filter((row) => row.count > 0)
              .map((row) => (
                <span
                  key={row.key}
                  data-aging-segment={row.key}
                  aria-hidden="true"
                  style={{
                    width: `${(row.count / pendingReview) * 100}%`,
                    backgroundColor: row.color,
                  }}
                />
              ))}
          </div>
          {aging.overdue > 0 && (
            <p className="mt-2 text-xs text-text-secondary">
              {formatCount(aging.overdue)} of {formatCount(pendingReview)}{" "}
              {applications} overdue
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">
          No applications awaiting review.
        </p>
      )}
      {/* Exact counts and named weekday ranges remain readable even for zero-width segments. */}
      <dl className="mt-4 space-y-3 text-xs">
        {rows.map((row) => (
          <div
            key={row.key}
            data-aging-category={row.key}
            className="flex items-center justify-between gap-3"
          >
            <dt className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0 break-words">
                <span className="block font-medium text-text-primary">
                  {row.label}
                </span>
                <span className="mt-0.5 block text-text-secondary">
                  {row.days}
                </span>
              </span>
            </dt>
            <dd className="shrink-0 font-semibold tabular-nums text-text-primary">
              {formatCount(row.count)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-stroke pt-3 text-xs leading-relaxed text-text-secondary">
        Submission day and weekends excluded.
      </p>
    </div>
  );
}
