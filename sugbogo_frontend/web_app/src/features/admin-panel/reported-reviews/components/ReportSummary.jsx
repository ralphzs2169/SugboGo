import { AlertCircle } from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";
import { REPORT_REASONS } from "../utils/reportedReviewPresentation";

function NeedsAttentionBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Needs Attention
    </span>
  );
}

function ReportSummary({ review }) {
  return (
    <section aria-label="Community report summary" className="border-t border-stroke pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">Community Reports</h3>
        {review.needs_attention && (
          <NeedsAttentionBadge />
        )}
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        {review.pending_report_count} pending {review.pending_report_count === 1 ? "report" : "reports"}. Community reports are evidence for a decision about this review.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(REPORT_REASONS).map(([reason, label]) => (
          <div key={reason} className="rounded-lg border border-stroke bg-surface px-3 py-3">
            <dt className="text-xs text-text-secondary">{label}</dt>
            <dd className="mt-1 text-lg font-semibold text-text-primary">{review.reason_counts?.[reason] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
        <p>First pending report: {formatDateTime(review.first_pending_at)}</p>
        <p>Latest pending report: {formatDateTime(review.latest_pending_at)}</p>
      </div>
    </section>
  );
}

export default ReportSummary;
