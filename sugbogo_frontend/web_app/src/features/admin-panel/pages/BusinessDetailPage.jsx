import { useNavigate, useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import PageHeader from "../components/PageHeader";
import useBusinessDetail from "../businesses/hooks/useBusinessDetail";

import BusinessDetailHero from "../businesses/components/business-detail/BusinessDetailHero";
import BusinessDetailMetrics from "../businesses/components/business-detail/BusinessDetailMetrics";
import BusinessDetailLocation from "../businesses/components/business-detail/BusinessDetailLocation";
import BusinessDetailHours from "../businesses/components/business-detail/BusinessDetailHours";
import BusinessDetailPhotoGallery from "../businesses/components/business-detail/BusinessDetailPhotoGallery";

export default function BusinessDetailPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();

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
      />

      {/* Business engagement */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Overview
        </h2>

        <BusinessDetailMetrics
          vouchCount={business.vouch_count}
          reviewCount={business.review_count}
          pocketCount={business.pocket_count}
        />
      </section>

      {/* Business location */}
      {/* 
      <BusinessDetailLocation
        location={business.location}
        landmarks={business.landmarks}
      /> */}

      {/* Operating hours and photo gallery */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BusinessDetailHours operatingHours={business.operating_hours} />

        <BusinessDetailPhotoGallery photos={business.photos} />
      </div>
    </div>
  );
}
