import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDisputeReview from "./ReviewDisputeReview";
import ReviewDisputeCaseInfo from "./ReviewDisputeCaseInfo";
import ReviewDisputeReports from "./ReviewDisputeReports";
import ReviewDisputeRequest from "./ReviewDisputeRequest";

const STATUS_BADGE_VARIANT = {
  pending: "warning",
  upheld: "success",
  dismissed: "neutral",
  withdrawn: "muted",
};

function formatLabel(value) {
  if (!value) {
    return "—";
  }

  return value.replaceAll("_", " ");
}

/**
 * Presents the disputed review and merchant dispute request,
 * alongside supporting case information and explorer reports.
 */
export default function ReviewDisputeSummary({ dispute }) {
  const review = dispute.review;

  return (
    <section>
      {/* Dispute status */}
      <div className="mb-4 flex justify-end">
        <StatusBadge
          variant={STATUS_BADGE_VARIANT[dispute.status] || "neutral"}
        >
          {formatLabel(dispute.status)}
        </StatusBadge>
      </div>

      {/* Case summary */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-5">
        {/* Review and dispute context */}
        <div className="p-6 lg:col-span-3 lg:border-r lg:border-stroke">
          {/* Original review and merchant response */}
          <ReviewDisputeReview review={review} />

          {/* Dispute relationship */}
          <div className="my-7 flex items-center gap-3 text-xs font-semibold text-text-secondary">
            <div className="h-px flex-1 bg-stroke" />

            <span>↓ disputed because</span>

            <div className="h-px flex-1 bg-stroke" />
          </div>

          {/* Dispute request */}
          <ReviewDisputeRequest dispute={dispute} />
        </div>

        {/* Case information and explorer reports */}
        <div className="lg:col-span-2">
          {/* Case information */}
          <ReviewDisputeCaseInfo dispute={dispute} />

          {/* Explorer reports */}
          <ReviewDisputeReports review={review} />
        </div>
      </div>
    </section>
  );
}
