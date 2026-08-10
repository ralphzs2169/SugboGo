import { useParams } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import BusinessApplicationReview from "../business-applications/components/review/BusinessApplicationReview";
import useMerchantApplicationReview from "../business-applications/hooks/useMerchantApplicationReview";
import ApplicationReviewSkeleton from "../business-applications/components/review/ApplicationReviewSkeleton";

export default function BusinessApplicationReviewPage() {
  const { applicationId } = useParams();

  useDocumentTitle("Review Business Application | SugboGo Admin");

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

      {/* Application review */}
      <BusinessApplicationReview application={application} />
    </>
  );
}
