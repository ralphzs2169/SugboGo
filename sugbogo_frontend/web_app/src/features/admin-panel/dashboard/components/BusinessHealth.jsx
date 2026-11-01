import { Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useDiscoveryScoreAnalytics } from "../../analytics/hooks/useAnalyticsReports";
import {
  formatCount,
  formatTimestamp,
} from "../../analytics/utils/presentation";
import { dashboardLinkClass } from "../utils/dashboardPresentation";
import DashboardQuerySection from "./DashboardQuerySection";

const STATUSES = [
  { key: "stale", label: "Stale", tone: "text-warning" },
  { key: "pending", label: "Pending", tone: "text-warning" },
  { key: "failed", label: "Failed", tone: "text-danger" },
];

/** Keep authoritative active-business score coverage compact, independently recoverable, and shared with Analytics. */
export default function BusinessHealth({ canViewScores, informationAction }) {
  const scores = useDiscoveryScoreAnalytics(
    { page_size: 1 },
    { enabled: canViewScores },
  );
  useApiErrorNotification(scores.error, {
    toastId: "admin-dashboard-discovery-health-load-error",
    fallbackMessage: "Unable to load Discovery Score health. Please try again.",
  });
  const coverage = scores.data?.coverage;
  const freshnessPercent =
    Number.isFinite(coverage?.fresh) &&
    Number.isFinite(coverage?.active_businesses) &&
    coverage.active_businesses > 0
      ? Math.min(
          100,
          Math.max(0, (coverage.fresh / coverage.active_businesses) * 100),
        )
      : null;
  const snapshot = coverage?.snapshot_at;
  const hasSnapshot = snapshot && Number.isFinite(Date.parse(snapshot));
  return (
    <section
      aria-label="Discovery Score Health"
      className="min-w-0 self-start rounded-xl border border-stroke bg-background p-4 sm:p-5"
    >
      {/* Definitions use the existing Analytics information control rather than permanent technical paragraphs. */}
      <header className="mb-3 flex items-center gap-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <Activity aria-hidden="true" className="h-4 w-4 shrink-0" />
          Discovery Score Health
        </h2>
        {canViewScores && informationAction}
      </header>
      {canViewScores ? (
        <>
          <DashboardQuerySection
            query={scores}
            label="Discovery Score coverage"
            framed={false}
            headerVisible={false}
          >
            {(data) =>
              !data.coverage ? (
                <DataErrorState
                  compact
                  title="Score health unavailable"
                  message="Coverage counts are unavailable. Please try again."
                  onRetry={() => scores.refetch()}
                  retrying={scores.isFetching}
                  retryLabel="Retry"
                />
              ) : data.coverage.active_businesses === 0 ? (
                <p className="py-3 text-sm text-text-secondary">
                  No active businesses to assess.
                </p>
              ) : (
                <div>
                  {/* Counters come directly from coverage; overlapping states are never added together. */}
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-text-primary">
                    {formatCount(data.coverage.fresh)} /{" "}
                    {formatCount(data.coverage.active_businesses)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    fresh scores
                  </p>
                  {/* This indicates score freshness coverage only, never overall system health. */}
                  {freshnessPercent !== null && (
                    <div
                      role="progressbar"
                      aria-label="Fresh Discovery Scores among active businesses"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={freshnessPercent}
                      aria-valuetext={`${formatCount(data.coverage.fresh)} of ${formatCount(data.coverage.active_businesses)} active businesses have fresh scores`}
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${freshnessPercent}%` }}
                      />
                    </div>
                  )}
                  <dl className="mt-2 grid grid-cols-3 gap-3">
                    {STATUSES.map((status) => (
                      <div key={status.key} className="min-w-0">
                        <dt className="text-xs text-text-secondary">
                          {status.label}
                        </dt>
                        <dd
                          className={`mt-1 break-words text-xl font-semibold tabular-nums ${data.coverage[status.key] > 0 ? status.tone : "text-text-primary"}`}
                        >
                          {formatCount(data.coverage[status.key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {(data.coverage.missing > 0 ||
                    data.coverage.provisional > 0) && (
                    <p className="mt-3 text-xs text-text-secondary">
                      {[
                        ["missing", "Missing"],
                        ["provisional", "Provisional"],
                      ]
                        .filter(([key]) => data.coverage[key] > 0)
                        .map(
                          ([key, label]) =>
                            `${label} ${formatCount(data.coverage[key])}`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                    Counts may overlap. Failed indicates recorded error markers.
                  </p>
                </div>
              )
            }
          </DashboardQuerySection>
          {/* One authorized drilldown and the server's coverage-read timestamp remain visible during recovery. */}
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stroke pt-2">
            <p className="text-xs text-text-secondary">
              Data as of{" "}
              {hasSnapshot ? (
                <time dateTime={snapshot}>
                  {formatTimestamp(snapshot)} PHT
                </time>
              ) : (
                "Unavailable"
              )}
            </p>
            <Link
              className={`${dashboardLinkClass} inline-flex min-h-9 items-center gap-2 text-xs`}
              to="/admin-panel/analytics/discovery-scores?status=active"
            >
              View Discovery Scores{" "}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </footer>
        </>
      ) : (
        <p className="text-xs text-text-secondary">
          Score monitoring is unavailable for this role.
        </p>
      )}
    </section>
  );
}
