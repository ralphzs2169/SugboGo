import { useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";

import useReviewDisputeDetail from "../review-disputes/hooks/useReviewDisputeDetail";
import ReviewDisputeDetailSkeleton from "../review-disputes/components/review-dispute-detail/ReviewDisputeDetailSkeleton";
import ReviewDisputeSummary from "../review-disputes/components/review-dispute-detail/ReviewDisputeSummary";
import ReviewDisputeEvidence from "../review-disputes/components/review-dispute-detail/ReviewDisputeEvidence";
import ReviewDisputeDecision from "../review-disputes/components/review-dispute-detail/ReviewDisputeDecision";

export default function ReviewDisputeDetailPage() {
  const { disputeId } = useParams();

  const { dispute, isLoading, error, refetch } =
    useReviewDisputeDetail(disputeId);

  useApiErrorNotification(error, {
    toastId: "review-dispute-detail-load-error",
    fallbackMessage: "Unable to load the review dispute. Please try again.",
  });

  const handleBack = useNavigateBack("/admin-panel/review-disputes");

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
    <DetailPageLayout
      breadcrumbs={breadcrumbs}
      title={dispute ? `Dispute #${dispute.id}` : "Review Dispute"}
      backLabel="Back to Disputes"
      onBack={handleBack}
      isLoading={isLoading}
      error={error}
      hasData={!!dispute}
      onRetry={refetch}
      loadingContent={<ReviewDisputeDetailSkeleton />}
      errorTitle="Dispute unavailable"
      errorMessage="The review dispute could not be loaded. Please try again."
    >
      {dispute && (
        <div className="space-y-6 pb-28">
          {/* Dispute summary */}
          <ReviewDisputeSummary dispute={dispute} />

          {/* Supporting evidence */}
          <ReviewDisputeEvidence evidence={dispute.evidence} />

          {/* Moderation decision */}
          <ReviewDisputeDecision dispute={dispute} />
        </div>
      )}
    </DetailPageLayout>
  );
}
