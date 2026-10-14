import { ExternalLink, Flag } from "lucide-react";
import { Link } from "react-router-dom";

import { REPORT_REASONS } from "../../../reported-reviews/utils/reportedReviewPresentation";
import { formatLabel } from "@/shared/utils/stringUtils";

/** Show community reports as supporting context for a merchant dispute. */
export default function ReviewDisputeReports({ review }) {
  const reportSummary = review?.report_summary ?? [];
  const totalReports = review?.report_count ??
    reportSummary.reduce((sum, report) => sum + report.count, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <Flag className="h-4 w-4 text-text-secondary" strokeWidth={1.75} aria-hidden="true" />
          Community Reports
        </h2>
        {totalReports > 0 && review?.id && (
          <Link
            to={`/admin-panel/moderation-integrity?tab=reported&reported_id=${review.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            View reports
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <p className="mt-3 text-sm text-text-secondary">
        {totalReports} {totalReports === 1 ? "report" : "reports"} submitted for this review
      </p>

      {reportSummary.length > 0 && (
        <div className="mt-3 divide-y divide-stroke border-y border-stroke">
          {reportSummary.map((report) => (
            <div key={report.reason} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-text-secondary">
                {REPORT_REASONS[report.reason] ?? formatLabel(report.reason)}
              </span>
              <span className="font-medium text-text-primary">{report.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
