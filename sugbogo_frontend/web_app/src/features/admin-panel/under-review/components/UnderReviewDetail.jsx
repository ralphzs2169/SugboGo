import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";

import useUnderReviewReview from "../hooks/useUnderReviewReview";
import UnderReviewFindings from "./UnderReviewFindings";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ReviewStickyContextBar from "../../moderation/components/ReviewStickyContextBar";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";
import { formatReviewTimestamp } from "../../moderation/components/reviewPresentation";

function DetailPlaceholder({ title, description }) {
  return (
    <div className="flex min-h-[460px] flex-col items-center justify-center px-8 text-center">
      <ShieldIcon />
      <h2 className="mt-4 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function ShieldIcon() {
  return <UserRound className="h-9 w-9 text-text-secondary" />;
}

export default function UnderReviewDetail({
  reviewId,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onStale,
}) {
  const scrollContainerRef = useRef(null);
  const reviewHeaderRef = useRef(null);
  const [showContextBar, setShowContextBar] = useState(false);
  const { review, isLoading, error, refetch } = useUnderReviewReview(reviewId);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const reviewHeader = reviewHeaderRef.current;

    if (!scrollContainer || !reviewHeader) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
      },
    );

    observer.observe(reviewHeader);

    return () => observer.disconnect();
  }, [review?.id]);

  if (!reviewId) {
    return (
      <DetailPlaceholder
        title="Select a review"
        description="Choose a review from the queue to inspect its content and moderation findings."
      />
    );
  }

  if (isLoading) {
    return (
      <ModerationDetailSkeleton
        label="Loading moderation review"
        sections={["Moderation Findings"]}
        showDecision
      />
    );
  }

  if (error) {
    return (
      <DataErrorState
        title="Unable to load this review"
        message="The review may no longer be available. Refresh the queue or try again."
        onRetry={() => {
          if (error.response?.status === 404) {
            onStale?.();
          } else {
            refetch();
          }
        }}
      />
    );
  }

  if (!review) {
    return null;
  }

  const isSubmitting = isApproving || isRejecting;
  const isPending = review.status === "under_review";
  const decision = review.decision;
  const reviewerName = [
    decision?.reviewed_by?.first_name,
    decision?.reviewed_by?.last_name,
  ].filter(Boolean).join(" ") || "Unknown reviewer";

  return (
    <div className="flex min-h-[640px] flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-250px)]"
        ref={scrollContainerRef}
      >
        <ReviewStickyContextBar review={review} visible={showContextBar} />
        <div ref={reviewHeaderRef} className="bg-background px-5 py-4 lg:px-6">
          <ReviewIdentityHeader review={review} />
        </div>

        <div className="mx-5 mt-5 lg:mx-6 lg:mt-6">
          <ReviewContentCard review={review} />
        </div>

        <div className="mx-5 my-6 lg:mx-6">
          <UnderReviewFindings review={review} />
        </div>
        {!isPending && decision && (
          <section className="mx-5 mb-6 rounded-xl border border-stroke p-4 lg:mx-6">
            <h3 className="text-sm font-semibold text-text-primary">Moderation Decision</h3>
            <p className="mt-2 text-sm text-text-primary">
              {decision.status === "approved" ? "Approved" : "Rejected"} by {reviewerName}
            </p>
            <time dateTime={decision.reviewed_at} className="mt-1 block text-xs text-text-secondary">
              {formatReviewTimestamp(decision.reviewed_at)}
            </time>
            <h4 className="mt-4 text-xs font-medium text-text-secondary">Decision notes</h4>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-primary">
              {decision.notes || "No notes recorded."}
            </p>
          </section>
        )}
      </div>

      {isPending && (
        <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-stroke bg-background px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-6">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">Admin Decision</h3>
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              Review the content and findings before deciding whether to publish or reject this review.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              variant="danger-outline"
              onClick={onReject}
              disabled={isSubmitting}
            >
              Reject Review
            </Button>
            <Button
              variant="success"
              onClick={onApprove}
              loading={isApproving}
              disabled={isSubmitting}
            >
              Approve &amp; Publish
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
