import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useBusinessDetail from "../businesses/hooks/useBusinessDetail";
import BusinessDetailSkeleton from "../businesses/components/business-detail/BusinessDetailSkeleton";
import BusinessDetailHero from "../businesses/components/business-detail/BusinessDetailHero";
import BusinessDetailMetrics from "../businesses/components/business-detail/BusinessDetailMetrics";
import BusinessReviewsPreview from "../businesses/components/business-detail/review-preview-section/BusinessReviewsPreview";
import ReviewInsightsCard from "../businesses/components/business-detail/ReviewInsightsCard";
import BusinessPhotosPreview from "../businesses/components/business-detail/BusinessPhotosPreview";
import BusinessLocationModal from "../businesses/components/business-detail/BusinessLocationModal";
import BusinessApplicationSummary from "../businesses/components/business-detail/BusinessApplicationSummary";
import BusinessDetailContextBar from "../businesses/components/business-detail/BusinessDetailContextBar";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

export default function BusinessDetailPage() {
  const { businessId } = useParams();

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [showContextBar, setShowContextBar] = useState(false);

  const businessDetailHeaderRef = useRef(null);

  const { business, isLoading, error, refetch } = useBusinessDetail(businessId);

  useApiErrorNotification(error, {
    toastId: "business-detail-load-error",
    fallbackMessage: "Unable to load business details. Please try again.",
  });

  useEffect(() => {
    if (!business) {
      return;
    }

    const header = businessDetailHeaderRef.current;

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
  }, [business]);

  const handleBack = useNavigateBack("/admin-panel/businesses");

  const breadcrumbs = [
    { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
    { label: "Management", href: "/admin-panel/businesses" },
    { label: "Businesses", href: "/admin-panel/businesses" },
    {
      label: business?.business_name || "Business",
    },
  ];
  return (
    <>
      {/* Compact context bar */}
      {showContextBar && business && (
        <BusinessDetailContextBar business={business} />
      )}

      <DetailPageLayout
        breadcrumbs={breadcrumbs}
        title="Business Details"
        backLabel="Back to Businesses"
        onBack={handleBack}
        isLoading={isLoading}
        error={error}
        hasData={!!business}
        onRetry={refetch}
        headerRef={businessDetailHeaderRef}
        loadingContent={<BusinessDetailSkeleton />}
        errorTitle="Business unavailable"
        errorMessage="The business details could not be loaded. Please try again."
      >
        {business && (
          <div className="space-y-8">
            {/* Business identity */}
            <BusinessDetailHero
              business={business}
              onOpenLocation={() => setIsLocationOpen(true)}
            />

            {/* Business engagement */}
            <section>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
                Business Engagement
              </h2>

              <BusinessDetailMetrics
                vouchCount={business.vouch_count}
                reviewCount={business.review_count}
                pocketCount={business.pocket_count}
                specialtyTags={business.specialty_tags}
              />
            </section>

            {/* Recent reviews & photos */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                Reviews & Photos
              </h2>

              <div className="mt-4 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
                <div className="flex lg:col-span-3">
                  <BusinessReviewsPreview
                    reviews={business.latest_reviews}
                    reviewCount={business.review_count}
                    businessId={business.id}
                  />
                </div>

                <div className="flex lg:col-span-2">
                  <BusinessPhotosPreview
                    photos={business.photos}
                    businessName={business.business_name}
                  />
                </div>
              </div>
            </section>

            {/* Stored review insights */}
            <ReviewInsightsCard
              businessId={business.id}
              insights={business.review_insights}
            />

            {/* Application summary */}
            <section>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
                Business Application
              </h2>

              <BusinessApplicationSummary application={business.application} />
            </section>
          </div>
        )}
      </DetailPageLayout>

      {/* Location modal */}
      {business && (
        <BusinessLocationModal
          isOpen={isLocationOpen}
          location={business.location}
          landmarks={business.landmarks}
          onClose={() => setIsLocationOpen(false)}
        />
      )}
    </>
  );
}
