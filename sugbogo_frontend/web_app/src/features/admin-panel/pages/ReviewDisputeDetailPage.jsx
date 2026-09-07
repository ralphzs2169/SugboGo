import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";

import useReviewDisputeDetail from "../review-disputes/hooks/useReviewDisputeDetail";
import ReviewDisputeDetailSkeleton from "../review-disputes/components/review-dispute-detail/ReviewDisputeDetailSkeleton";
import ReviewDisputeSummary from "../review-disputes/components/review-dispute-detail/ReviewDisputeSummary";
import ReviewDisputeEvidence from "../review-disputes/components/review-dispute-detail/ReviewDisputeEvidence";
import ReviewDisputeDecision from "../review-disputes/components/review-dispute-detail/ReviewDisputeDecision";
import ReviewDisputeHistory from "../review-disputes/components/review-dispute-detail/ReviewDisputeHistory";
import ReviewDisputeDetailContextBar from "../review-disputes/components/review-dispute-detail/ReviewDisputeDetailContextBar";

/**
 * Displays the complete administrator view of a review dispute, including
 * case details, evidence, previous attempts, and moderation actions.
 */
export default function ReviewDisputeDetailPage() {
  const { disputeId } = useParams();
  const navigate = useNavigate();

  const [showContextBar, setShowContextBar] = useState(false);

  const disputeDetailHeaderRef = useRef(null);

  const { dispute, isLoading, error, refetch } =
    useReviewDisputeDetail(disputeId);

  useApiErrorNotification(error, {
    toastId: "review-dispute-detail-load-error",
    fallbackMessage: "Unable to load the review dispute. Please try again.",
  });

  useEffect(() => {
    if (!dispute) {
      return;
    }

    const header = disputeDetailHeaderRef.current;

    if (!header) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        threshold: 0,
      },
    );

    observer.observe(header);

    return () => observer.disconnect();
  }, [dispute]);

  const handleBack = useNavigateBack("/admin-panel/review-disputes");

  function handleDisputeResolved() {
    navigate("/admin-panel/review-disputes");
  }

  const breadcrumbs = [
    {
      label: "SugboGo Admin",
      href: "/admin-panel/dashboard",
    },
    {
      label: "Moderation",
    },
    {
      label: "Review Disputes",
      href: "/admin-panel/review-disputes",
    },
    {
      label: dispute ? `Dispute #${dispute.id}` : "Review Dispute",
    },
  ];

  return (
    <>
      {/* Compact dispute context */}
      {showContextBar && dispute && (
        <ReviewDisputeDetailContextBar dispute={dispute} />
      )}

      {/* Dispute detail content */}
      <DetailPageLayout
        breadcrumbs={breadcrumbs}
        title={dispute ? `Dispute #${dispute.id}` : "Review Dispute"}
        backLabel="Back to Disputes"
        onBack={handleBack}
        isLoading={isLoading}
        error={error}
        hasData={!!dispute}
        onRetry={refetch}
        headerRef={disputeDetailHeaderRef}
        loadingContent={<ReviewDisputeDetailSkeleton />}
        errorTitle="Dispute unavailable"
        errorMessage="The review dispute could not be loaded. Please try again."
      >
        {dispute && (
          <div className="space-y-6 pb-12">
            {/* Dispute summary */}
            <ReviewDisputeSummary dispute={dispute} />

            {/* Supporting evidence */}
            <ReviewDisputeEvidence evidence={dispute.evidence} />

            {/* Previous dispute attempts */}
            <ReviewDisputeHistory
              previousDisputes={dispute.previous_disputes}
              currentAttempt={dispute.attempt_number}
            />

            {/* Moderation decision */}
            <ReviewDisputeDecision
              dispute={dispute}
              onResolved={handleDisputeResolved}
            />
          </div>
        )}
      </DetailPageLayout>
    </>
  );
}
