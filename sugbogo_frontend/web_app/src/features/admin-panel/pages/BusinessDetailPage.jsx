import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import PageHeader from "../components/PageHeader";
import useBusinessDetail from "../businesses/hooks/useBusinessDetail";

import BusinessDetailHero from "../businesses/components/business-detail/BusinessDetailHero";
import BusinessDetailMetrics from "../businesses/components/business-detail/BusinessDetailMetrics";
import BusinessReviewsPreview from "../businesses/components/business-detail/BusinessReviewsPreview";
import BusinessPhotosPreview from "../businesses/components/business-detail/BusinessPhotosPreview";
import BusinessLocationModal from "../businesses/components/business-detail/BusinessLocationModal";
import BusinessApplicationSummary from "../businesses/components/business-detail/BusinessApplicationSummary";

export default function BusinessDetailPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();

  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const { business, isLoading, error, refetch } = useBusinessDetail(businessId);

  useApiErrorNotification(error, {
    toastId: "business-detail-load-error",
    fallbackMessage: "Unable to load business details. Please try again.",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "SugboGo Admin", href: "/admin" },
            { label: "Management", href: "/admin/businesses" },
            { label: "Businesses", href: "/admin/businesses" },
            { label: "Business" },
          ]}
          title="Business"
        />

        <div className="h-72 animate-pulse rounded-xl border border-stroke bg-surface" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "SugboGo Admin", href: "/admin" },
            { label: "Management", href: "/admin/businesses" },
            { label: "Businesses", href: "/admin/businesses" },
            { label: "Business" },
          ]}
          title="Business"
        />

        <div className="flex min-h-72 items-center justify-center rounded-xl border border-stroke bg-surface-muted">
          <div className="text-center">
            <p className="text-sm font-semibold text-text-primary">
              Unable to load business
            </p>

            <p className="mt-1 text-sm text-text-secondary">
              The requested business could not be loaded.
            </p>

            <button
              type="button"
              onClick={refetch}
              className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin" },
          { label: "Management", href: "/admin/businesses" },
          { label: "Businesses", href: "/admin/businesses" },
          { label: business.business_name },
        ]}
        title={business.business_name}
      />

      {/* Business identity */}
      <BusinessDetailHero
        business={business}
        onBack={() => navigate("/admin-panel/businesses")}
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

      {/* Application summary */}
      <section>
        <h2 className="text-xs mb-4 font-bold uppercase tracking-widest text-text-secondary">
          Business Application
        </h2>

        <BusinessApplicationSummary application={business.application} />
      </section>

      {/* Location modal */}
      <BusinessLocationModal
        isOpen={isLocationOpen}
        location={business.location}
        landmarks={business.landmarks}
        onClose={() => setIsLocationOpen(false)}
      />
    </div>
  );
}
