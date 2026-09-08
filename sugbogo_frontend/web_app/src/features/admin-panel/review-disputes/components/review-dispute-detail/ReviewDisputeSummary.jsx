import StatusBadge from "@/shared/components/StatusBadge";

import ReviewDisputeReview from "./ReviewDisputeReview";
import ReviewDisputeCaseInfo from "./ReviewDisputeCaseInfo";
import ReviewDisputeReports from "./ReviewDisputeReports";
import ReviewDisputeRequest from "./ReviewDisputeRequest";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";
import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Presents the core dispute case, including the original review, merchant
 * dispute request, supporting case information, and explorer report activity.
 */
export default function ReviewDisputeSummary({ dispute }) {
  const review = dispute.review;

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Dispute Case
        </h2>

        <StatusBadge
          variant={
            REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] || "neutral"
          }
        >
          {formatLabel(dispute.status)}
        </StatusBadge>
      </div>

      {/* Case summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Review and dispute context */}
        <div className="p-6 lg:col-span-3 lg:border-r lg:border-stroke">
          {/* Original review */}
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

        {/* Supporting case context */}
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
