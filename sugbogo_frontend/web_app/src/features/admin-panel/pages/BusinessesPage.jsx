import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import PageHeader from "../components/PageHeader";
import BusinessManagementTable from "../businesses/components/BusinessManagementTable";
import BusinessLocationsSection from "../businesses/components/business-location/BusinessLocationsSection";
import BusinessMetrics from "../businesses/components/BusinessMetrics";
import useBusinessMap from "../businesses/hooks/useBusinessMap";
import { useNavigate } from "react-router-dom";

export default function BusinessesPage() {
  useDocumentTitle("Businesses | SugboGo Admin");

  const navigate = useNavigate();

  function handleViewBusiness(business) {
    navigate(`/admin-panel/businesses/${business.id}`);
  }

  const {
    businesses,
    isLoading: isMapLoading,
    error: mapError,
    refetch: refetchMap,
  } = useBusinessMap();

  useApiErrorNotification(mapError, {
    toastId: "business-map-load-error",
    fallbackMessage: "Unable to load business locations. Please try again.",
  });

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin",
          },
          {
            label: "Management",
            href: "/admin/businesses",
          },
          {
            label: "Businesses",
          },
        ]}
        title="Business Management"
      />

      {/* Business overview */}
      <section className="mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Overview
        </h2>

        {/* Business metrics */}
        <BusinessMetrics />

        {/* Business locations */}
        <div className="mt-6">
          <BusinessLocationsSection
            businesses={businesses}
            isLoading={isMapLoading}
            error={mapError}
            onRetry={refetchMap}
          />
        </div>
      </section>

      {/* Business management */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          All Businesses
        </h2>

        <BusinessManagementTable />
      </section>
    </>
  );
}
