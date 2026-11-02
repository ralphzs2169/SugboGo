import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import StatusBadge from "@/shared/components/StatusBadge";
import statusConfig from "../../../business-applications/config/applicationStatus.config";
import { formatLabel } from "@/shared/utils/stringUtils";
import { formatBusinessDateTime } from "../../utils/businessDetailPresentation";

/** Present linked application provenance without confusing review, submission and business dates. */
export default function BusinessApplicationSummary({ application }) {
  const status = statusConfig[application?.status];
  const identity = application?.identity;
  const values = application
    ? [
        [
          "Authorized representative",
          identity?.representative_name || "Unavailable",
          identity?.representative_role
            ? formatLabel(identity.representative_role)
            : null,
        ],
        ["Submitted", formatBusinessDateTime(application.submitted_at)],
        [
          application.status === "approved" ? "Approved" : "Reviewed",
          formatBusinessDateTime(application.reviewed_at),
        ],
        [
          "Submissions",
          Number.isInteger(application.submission_count)
            ? application.submission_count +
              (application.submission_count === 1 ? " attempt" : " attempts")
            : "Unavailable",
        ],
      ]
    : [];
  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Application identity and outcome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Business Application
        </h2>
        {application && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary">
              #{application.id}
            </span>
            <StatusBadge variant={status?.variant || "neutral"}>
              {status?.label || application.status || "Unknown outcome"}
            </StatusBadge>
          </div>
        )}
      </div>
      {!application ? (
        <p className="p-5 text-sm text-text-secondary">
          No linked application is available for this business.
        </p>
      ) : (
        <div className="p-5">
          {/* Original application provenance */}
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {values.map(([label, value, secondary]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-text-secondary">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-text-primary">
                  {value}
                  {secondary && (
                    <span className="mt-1 block text-xs font-normal text-text-secondary">
                      {secondary}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-text-secondary">
            Dates shown in Philippine time.
          </p>
          <div className="mt-4 flex justify-end border-t border-stroke pt-4">
            <Link
              to={"/admin-panel/business/application/" + application.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-info"
            >
              View Full Application
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
