import { FileWarning } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";
import useReviewStickyContext from "../../moderation/hooks/useReviewStickyContext";

import useReviewDisputeDetail from "../hooks/useReviewDisputeDetail";
import { isDisputeDecisionEligible } from "../config/reviewDisputeDecisionConfig";
import DisputeIdentityHeader from "./DisputeIdentityHeader";
import ReviewDisputeDetailContextBar from "./review-dispute-detail/ReviewDisputeDetailContextBar";
import ReviewDisputeEvidence from "./review-dispute-detail/ReviewDisputeEvidence";
import ReviewDisputeHistory from "./review-dispute-detail/ReviewDisputeHistory";
import ReviewDisputeReports from "./review-dispute-detail/ReviewDisputeReports";
import ReviewDisputeRequest from "./review-dispute-detail/ReviewDisputeRequest";
import ReviewDisputeReview from "./review-dispute-detail/ReviewDisputeReview";

export default function DisputeInvestigation({ disputeId, onDecision, decisionPending }) {
  const { dispute, isLoading, isFetching, error, refetch } = useReviewDisputeDetail(disputeId);
  const {
    scrollContainerRef,
    reviewHeaderRef,
    showContextBar,
  } = useReviewStickyContext(dispute?.id);

  if (!disputeId) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary">
        <FileWarning className="h-8 w-8" />
        <h2 className="mt-3 font-semibold text-text-primary">Select a dispute</h2>
        <p className="mt-1 text-sm">Choose a case to inspect the review, evidence, and dispute request.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <ModerationDetailSkeleton
        label="Loading dispute investigation"
        sections={["Dispute Request", "Community Reports", "Evidence", "Previous Disputes"]}
        showDecision
      />
    );
  }

  if (error || !dispute) {
    return (
      <DataErrorState
        title="Unable to load this dispute"
        message="The dispute details could not be loaded."
        onRetry={refetch}
      />
    );
  }

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto lg:max-h-[calc(100vh-260px)]">
      <ReviewDisputeDetailContextBar dispute={dispute} visible={showContextBar} />
      <article className="space-y-6 p-5 pb-8 sm:p-6">
        <div ref={reviewHeaderRef}>
          <DisputeIdentityHeader dispute={dispute} />
        </div>
        <div id="dispute-original-review" className="scroll-mt-16">
          <ReviewDisputeReview dispute={dispute} />
        </div>
        <section className="border-t border-stroke pt-5">
          <ReviewDisputeRequest dispute={dispute} />
        </section>
        <section className="border-t border-stroke pt-5">
          <ReviewDisputeReports review={dispute.review} />
        </section>
        <ReviewDisputeEvidence evidence={dispute.evidence} />
        <ReviewDisputeHistory
          previousDisputes={dispute.previous_disputes}
          currentAttempt={dispute.attempt_number}
        />
      </article>
      {dispute.status === "pending" && (
        <section
          aria-label="Review decision"
          className="sticky bottom-0 z-20 border-t border-stroke bg-background px-5 py-3.5 sm:px-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Review Decision</h3>
              <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                Review the dispute and determine the appropriate outcome.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                disabled={decisionPending || isFetching || !isDisputeDecisionEligible(dispute)}
                onClick={() => onDecision(dispute, "dismiss")}
              >
                Dismiss
              </Button>
              <Button
                variant="primary"
                disabled={decisionPending || isFetching || !isDisputeDecisionEligible(dispute)}
                onClick={() => onDecision(dispute, "uphold")}
              >
                Uphold Dispute
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
