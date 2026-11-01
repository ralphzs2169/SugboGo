import { ArrowRight, Store, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useDiscoveryScoreAnalytics } from "../../analytics/hooks/useAnalyticsReports";
import { formatCount, formatTimestamp } from "../../analytics/utils/presentation";
import { dashboardLinkClass, dashboardQueues } from "../utils/dashboardPresentation";
import DashboardQuerySection from "./DashboardQuerySection";

/** Reuse the canonical Analytics health query while keeping business inventory independently recoverable. */
export default function BusinessHealth({ summary, canViewScores }) {
  const scores = useDiscoveryScoreAnalytics({ page_size: 1 }, { enabled: canViewScores });
  useApiErrorNotification(scores.error, {
    toastId: "admin-dashboard-discovery-health-load-error",
    fallbackMessage: "Unable to load Discovery Score health. Please try again.",
  });

  return (
    <section aria-label="Discovery Health" className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5">
      {/* Current business inventory uses the existing summary resource */}
      <h2 className="mb-4 text-base font-semibold text-text-primary">Discovery Health</h2>
      <DashboardQuerySection query={summary} label="Active businesses" framed={false} headingAs="h3">
        {(data) => (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-text-primary">{formatCount(data.active_businesses)}</span>
              <Store aria-hidden="true" className="h-5 w-5 text-text-secondary" />
            </div>
            <Link className={`${dashboardLinkClass} mt-3 inline-flex min-h-9 items-center gap-2 text-xs`} to={dashboardQueues.activeBusinesses}>
              View active inventory <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DashboardQuerySection>
      {/* Coverage is a separate canonical query, never inferred from a returned score row */}
      {canViewScores && (
        <div className="mt-4 border-t border-stroke pt-4">
          <DashboardQuerySection query={scores} label="Recorded score error markers" framed={false} headingAs="h3">
            {(data) => (
              <div>
                <div className="flex items-center gap-2">
                  <TriangleAlert aria-hidden="true" className="h-4 w-4 text-text-secondary" />
                  <span className="text-xl font-semibold tabular-nums text-text-primary">{formatCount(data.coverage?.failed)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">Active businesses with a recorded score error marker. A marker may remain from an earlier attempt and does not confirm a currently failing process.</p>
                {data.coverage?.snapshot_at && <p className="mt-1 text-xs text-text-secondary">As of {formatTimestamp(data.coverage.snapshot_at)} · Manila</p>}
                <Link className={`${dashboardLinkClass} mt-3 inline-flex min-h-9 items-center gap-2 text-xs`} to="/admin-panel/analytics/discovery-scores?status=active">
                  View Discovery Scores <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </DashboardQuerySection>
        </div>
      )}
    </section>
  );
}
