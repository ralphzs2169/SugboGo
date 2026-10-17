import { useQuery } from "@tanstack/react-query";
import { Flag } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import ReviewStickyContextBar from "../../moderation/components/ReviewStickyContextBar";
import useReviewStickyContext from "../../moderation/hooks/useReviewStickyContext";
import { fetchReportedReview } from "../services/reportedReviewService";
import AdminDecision from "./AdminDecision";
import IndividualReports from "./IndividualReports";
import ReportSummary from "./ReportSummary";

function ReportedReviewDetail({ reviewId, onStale, onDecision, decisionPending }) {
  const { data: review, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "reported-reviews", "detail", reviewId],
    queryFn: () => fetchReportedReview(reviewId),
    enabled: Boolean(reviewId),
    retryOnMount: false,
  });
  const {
    scrollContainerRef,
    reviewHeaderRef,
    showContextBar,
  } = useReviewStickyContext(review?.id);

  if (!reviewId) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary">
        <Flag className="h-8 w-8" />
        <h2 className="mt-3 font-semibold text-text-primary">Select a reported review</h2>
        <p className="mt-1 text-sm">Choose a review to inspect its content and pending reports.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <ModerationDetailSkeleton
        label="Loading reported review"
        sections={["Community Reports", "Individual Reports"]}
        showDecision
      />
    );
  }
  if (error) {
    if (error.response?.status === 404) {
      return (
        <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary">
          <Flag className="h-8 w-8" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-text-primary">No pending reports for this review</h2>
          <p className="mt-1 text-sm">This review is no longer in the active Reported queue.</p>
          <button type="button" onClick={onStale} className="mt-4 text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
            Back to reported reviews
          </button>
        </div>
      );
    }
    return (
      <DataErrorState
        title="Unable to load this reported review"
        message="The review may no longer have pending reports."
        onRetry={refetch}
      />
    );
  }
  if (!review) {
    return null;
  }

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto lg:max-h-[calc(100vh-260px)]">
      <ReviewStickyContextBar review={review} visible={showContextBar} statusVariant={review.status === "rejected" ? "dangerSoft" : undefined} />
      <article className="space-y-6 p-5 pb-8 sm:p-6 sm:pb-8">
        <div ref={reviewHeaderRef}>
          <ReviewIdentityHeader review={review} statusVariant={review.status === "rejected" ? "dangerSoft" : undefined} />
        </div>
        <ReviewContentCard review={review} />
        <ReportSummary review={review} />
        <IndividualReports review={review} />
      </article>
      <AdminDecision review={review} onDecision={onDecision} pending={decisionPending} />
    </div>
  );
}

export default ReportedReviewDetail;
