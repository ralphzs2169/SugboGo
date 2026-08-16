import { useNavigate, useParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useBusiness from "../hooks/useBusiness";

import BusinessDetailHero from "../components/BusinessDetailHero";
import BusinessDetailMetrics from "../components/BusinessDetailMetrics";
import BusinessDescription from "../components/BusinessDescription";
import BusinessDetailLocation from "../components/BusinessDetailLocation";
import BusinessOperatingHours from "../components/BusinessOperatingHours";
import BusinessPhotoGallery from "../components/BusinessPhotoGallery";
import BusinessReviews from "../components/BusinessReviews";
import BusinessApplicationHistory from "../components/BusinessApplicationHistory";

export default function BusinessDetailPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();

  const { business, isLoading, error, refetch } = useBusiness(businessId);

  useApiErrorNotification(error, {
    toastId: "business-detail-load-error",
    fallbackMessage: "Unable to load business details. Please try again.",
  });

  if (isLoading) {
    return <BusinessDetailSkeleton />;
  }

  if (error || !business) {
    return (
      <BusinessDetailError
        onRetry={refetch}
        onBack={() => navigate("/admin-panel/businesses")}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Business identity */}
      <BusinessDetailHero business={business} />

      {/* Business engagement */}
      <BusinessDetailMetrics
        vouchCount={business.vouch_count}
        reviewCount={business.review_count}
        pocketCount={business.pocket_count}
      />

      {/* Business description */}
      <BusinessDescription description={business.description} />

      {/* Business location */}
      <BusinessDetailLocation location={business.location} />

      {/* Operating hours and photos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BusinessOperatingHours operatingHours={business.operating_hours} />

        <BusinessPhotoGallery photos={business.photos} />
      </div>

      {/* Explorer reviews */}
      <BusinessReviews reviewCount={business.review_count} />

      {/* Application history */}
      <BusinessApplicationHistory application={business.application} />
    </div>
  );
}
