import StatusBadge from "@/shared/components/StatusBadge";
import { formatReviewTimestamp } from "../../moderation/components/reviewPresentation";
import { REPORT_REASONS } from "../utils/reportedReviewPresentation";
import ReportExplanation from "./ReportExplanation";

function ReportRow({ report, resolved = false }) {
  return (
    <article className="px-4 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center rounded-md border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
            {REPORT_REASONS[report.type] ?? "Report"}
          </span>
          <time dateTime={report.created_at} className="text-xs text-text-secondary">
            {formatReviewTimestamp(report.created_at)}
          </time>
          {resolved && <StatusBadge variant="muted">{report.status}</StatusBadge>}
        </div>
        <span className="shrink-0 text-xs text-text-secondary">#{report.id}</span>
      </div>
      <ReportExplanation explanation={report.explanation} reportId={report.id} />
      {resolved && report.admin_notes && (
        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-text-secondary">
          Decision notes: {report.admin_notes}
        </p>
      )}
    </article>
  );
}

export default ReportRow;
