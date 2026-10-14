import StatusBadge from "@/shared/components/StatusBadge";
import { formatReviewTimestamp } from "../../moderation/components/reviewPresentation";
import { REPORT_REASONS } from "../utils/reportedReviewPresentation";
import ReportExplanation from "./ReportExplanation";

const REPORT_STATUS_PRESENTATION = {
  approved: {
    label: "Confirmed",
    variant: "successSoft",
  },
  rejected: {
    label: "Dismissed",
    variant: "mutedSoft",
  },
  withdrawn: {
    label: "Withdrawn",
    variant: "mutedSoft",
  },
};

function ReportRow({ report, resolved = false }) {
  const statusPresentation = REPORT_STATUS_PRESENTATION[report.status];

  return (
    <article className="px-4 py-3.5">
      {/* Report metadata */}
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          {/* Report reason */}
          <span className="inline-flex items-center rounded-full border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
            {REPORT_REASONS[report.type] ?? "Report"}
          </span>

          {/* Historical resolution status */}
          {resolved && statusPresentation && (
            <StatusBadge variant={statusPresentation.variant}>
              {statusPresentation.label}
            </StatusBadge>
          )}

          {/* Submission time */}
          <time
            dateTime={report.created_at}
            className="text-xs text-text-secondary"
            title={`Submitted ${formatReviewTimestamp(report.created_at)}`}
          >
            Submitted {formatReviewTimestamp(report.created_at)}
          </time>
        </div>

        {/* Traceability metadata */}
        <span className="shrink-0 text-[11px] text-text-secondary">
          Report #{report.id}
        </span>
      </div>

      {/* Reporter explanation */}
      {report.explanation && (
        <div className="mt-3">
          <p className="text-xs font-medium text-text-secondary">Explanation</p>

          <ReportExplanation
            explanation={report.explanation}
            reportId={report.id}
          />
        </div>
      )}

      {/* Historical Admin decision */}
      {resolved && report.admin_notes && (
        <div className="mt-3 border-l-2 border-stroke pl-3">
          <p className="text-xs font-medium text-text-secondary">
            Decision note
          </p>

          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-text-secondary">
            {report.admin_notes}
          </p>
        </div>
      )}
    </article>
  );
}

export default ReportRow;
