import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import ReviewStickyContextBar from "../../moderation/components/ReviewStickyContextBar";
import useReviewStickyContext from "../../moderation/hooks/useReviewStickyContext";
import { fetchSuspiciousReview } from "../services/suspiciousReviewService";
import CurrentActivity from "./CurrentActivity";
import DetectionEvidence from "./DetectionEvidence";
import SignalBadges from "./SignalBadges";

function InvestigationDetail({ reviewId, onStale }) {
  const { data: review, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-reviews", "detail", reviewId],
    queryFn: () => fetchSuspiciousReview(reviewId),
    enabled: Boolean(reviewId),
    retryOnMount: false,
  });
  const {
    scrollContainerRef,
    reviewHeaderRef,
    showContextBar,
  } = useReviewStickyContext(review?.id);

  if (!reviewId) {
    return <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary"><ShieldAlert className="h-8 w-8" /><h2 className="mt-3 font-semibold text-text-primary">Select a review</h2><p className="mt-1 text-sm">Choose a review from the queue to investigate its reliability signals.</p></div>;
  }
  if (isLoading) {
    return (
      <ModerationDetailSkeleton
        label="Loading investigation"
        sections={["Reliability Signals", "Why It Was Flagged", "Current Related Activity"]}
      />
    );
  }
  if (error) {
    return <DataErrorState title="Unable to load this investigation" message="The review may no longer be in the suspicious queue." onRetry={() => error.response?.status === 404 ? onStale() : refetch()} />;
  }
  if (!review) {
    return null;
  }

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto lg:max-h-[calc(100vh-260px)]">
      <ReviewStickyContextBar review={review} visible={showContextBar} />
      <article className="space-y-6 p-5 sm:p-6">
        <div ref={reviewHeaderRef}>
          <ReviewIdentityHeader review={review} />
        </div>
        <ReviewContentCard review={review} />
        <section aria-label="Reliability signals" className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-text-secondary" strokeWidth={1.75} aria-hidden="true" />
            <h3 className="text-base font-semibold text-text-primary">Reliability Signals</h3>
          </div>
          <p className="text-xs text-text-secondary">
            Latest reliability check: {review.reliability_check_outcome === "checked"
              ? "Completed"
              : review.reliability_check_outcome === "unavailable"
                ? "Unavailable"
                : "Historical outcome unknown"}
          </p>
          <SignalBadges reasons={review.reasons} />
        </section>
        <DetectionEvidence review={review} />
        <CurrentActivity review={review} />
      </article>
    </div>
  );
}

export default InvestigationDetail;
