import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDisputeReview from "./ReviewDisputeReview";
import ReviewDisputeCaseInfo from "./ReviewDisputeCaseInfo";
import ReviewDisputeReports from "./ReviewDisputeReports";
import ReviewDisputeRequest from "./ReviewDisputeRequest";
import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";
import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Presents the disputed review and merchant dispute request,
 * alongside supporting case information and explorer reports.
 */
export default function ReviewDisputeSummary({ dispute }) {
  const review = dispute.review;

  return (
    <section>
      {/* Case summary */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-5">
        {/* Review and dispute context */}
        <div className="relative p-6 lg:col-span-3 lg:border-r lg:border-stroke">
          {/* Dispute status */}
          <div className="absolute right-6 top-6">
            <StatusBadge
              variant={
                REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] || "neutral"
              }
            >
              {formatLabel(dispute.status)}
            </StatusBadge>
          </div>

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
