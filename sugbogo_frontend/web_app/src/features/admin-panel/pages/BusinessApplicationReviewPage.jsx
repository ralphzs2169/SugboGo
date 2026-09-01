import { useParams } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import BusinessApplicationReview from "../business-applications/components/review/BusinessApplicationReview";
import useMerchantApplicationReview from "../business-applications/hooks/useMerchantApplicationReview";
import ApplicationReviewSkeleton from "../business-applications/components/review/ApplicationReviewSkeleton";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

export default function BusinessApplicationReviewPage() {
  const { applicationId } = useParams();

  useDocumentTitle("Review Business Application | SugboGo Admin");

  const handleBack = useNavigateBack("/admin-panel/businesses/applications");

  const { application, isLoading, error, refetch } =
    useMerchantApplicationReview(applicationId);

  const breadcrumbs = [
    { label: "SugboGo Admin" },
    { label: "Management" },
    { label: "Merchant Applications" },
    {
      label: application?.identity?.business_name || "Review",
    },
  ];

  return (
    <DetailPageLayout
      breadcrumbs={breadcrumbs}
      title="Review Business Application"
      backLabel="Back to Applications"
      onBack={handleBack}
      isLoading={isLoading}
      error={error}
      hasData={!!application}
      onRetry={refetch}
      loadingContent={<ApplicationReviewSkeleton />}
      errorTitle="Application unavailable"
      errorMessage="The business application could not be loaded. Please try again."
    >
      {/* Application review */}
      <BusinessApplicationReview
        application={application}
        onApplicationRejected={handleBack}
        onApplicationApproved={handleBack}
      />
    </DetailPageLayout>
  );
}
