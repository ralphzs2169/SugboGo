import { useParams } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import BusinessApplicationReview from "../business-applications/components/review/BusinessApplicationReview";
import useMerchantApplicationReview from "../business-applications/hooks/useMerchantApplicationReview";
import ApplicationReviewSkeleton from "../business-applications/components/review/ApplicationReviewSkeleton";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BusinessApplicationReviewPage() {
  const { applicationId } = useParams();

  useDocumentTitle("Review Business Application | SugboGo Admin");

  const navigate = useNavigate();

  function handleBack() {
    navigate(-1);
  }

  const { application, isLoading, error, refetch } =
    useMerchantApplicationReview(applicationId);

  if (isLoading) {
    return (
      <>
        {/* Page header */}
        <PageHeader
          breadcrumbs={[
            { label: "SugboGo Admin" },
            { label: "Business Management" },
            { label: "Applications" },
            { label: "Review" },
          ]}
          title="Review Business Application"
        />

        {/* Loading state */}
        <ApplicationReviewSkeleton />
      </>
    );
  }

  if (error || !application) {
    return (
      <>
        {/* Page header */}
        <PageHeader
          breadcrumbs={[
            { label: "SugboGo Admin" },
            { label: "Business Management" },
            { label: "Applications" },
            { label: "Review" },
          ]}
          title="Review Business Application"
        />

        {/* Return navigation */}
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={17} strokeWidth={1.8} />
          <span>Back to Applications</span>
        </button>
        {/* Application loading error */}
        <DataErrorState
          title="Application unavailable"
          message="The business application could not be loaded."
          onRetry={refetch}
        />
      </>
    );
  }

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin" },
          { label: "Business Management" },
          { label: "Applications" },
          {
            label: application.identity?.business_name || "Review",
          },
        ]}
        title="Review Business Application"
      />
      {/* Return navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>Back to Applications</span>
      </button>

      {/* Application review */}
      <BusinessApplicationReview
        application={application}
        onApplicationRejected={refetch}
      />
    </>
  );
}
