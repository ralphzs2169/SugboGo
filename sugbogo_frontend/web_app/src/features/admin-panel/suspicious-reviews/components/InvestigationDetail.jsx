import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
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
    return <div aria-busy="true" className="p-6 text-sm text-text-secondary">Loading investigation…</div>;
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
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Reliability Signals</h3>
          <SignalBadges reasons={review.reasons} />
        </section>
        <DetectionEvidence review={review} />
        <CurrentActivity review={review} />
      </article>
    </div>
  );
}

export default InvestigationDetail;
