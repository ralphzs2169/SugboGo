import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useNavigateBack from "@/shared/hooks/useNavigateBack";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Button from "@/shared/components/Button";
import useBusinessDetail from "../businesses/hooks/useBusinessDetail";
import useBusinessDetailResources from "../businesses/hooks/useBusinessDetailResources";
import useBusinessInsightSync from "../businesses/hooks/useBusinessInsightSync";
import BusinessStatusDialog from "../businesses/components/BusinessStatusDialog";
import BusinessRowActions from "../businesses/components/BusinessRowActions";
import BusinessDetailSkeleton from "../businesses/components/business-detail/BusinessDetailSkeleton";
import BusinessDetailHero from "../businesses/components/business-detail/BusinessDetailHero";
import BusinessDetailMetrics from "../businesses/components/business-detail/BusinessDetailMetrics";
import BusinessReviewsPreview from "../businesses/components/business-detail/review-preview-section/BusinessReviewsPreview";
import ReviewInsightsCard from "../businesses/components/business-detail/ReviewInsightsCard";
import BusinessPhotosPreview from "../businesses/components/business-detail/BusinessPhotosPreview";
import BusinessLocationModal from "../businesses/components/business-detail/BusinessLocationModal";
import BusinessApplicationSummary from "../businesses/components/business-detail/BusinessApplicationSummary";
import BusinessAdministrativeHistory from "../businesses/components/business-detail/BusinessAdministrativeHistory";
import BusinessDetailContextBar from "../businesses/components/business-detail/BusinessDetailContextBar";

const BusinessDetailPreview = import.meta.env.DEV
  ? lazy(() =>
      import("../businesses/components/business-detail/BusinessDetailPreview"),
    )
  : null;

/** Scope local dialogs and insight observation to the business route's ownership. */
export default function BusinessDetailPage() {
  const { businessId } = useParams();
  if (BusinessDetailPreview) {
    return (
      <Suspense fallback={<BusinessDetailSkeleton />}>
        <BusinessDetailPreview
          key={businessId}
          renderLive={() => (
            <BusinessDetailContent key={businessId} businessId={businessId} />
          )}
        />
      </Suspense>
    );
  }
  return <BusinessDetailContent key={businessId} businessId={businessId} />;
}

/** Coordinate authoritative detail, optional sections and the shared administrative workflows. */
function BusinessDetailContent({ businessId }) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [operation, setOperation] = useState(null);
  const hero = useRef(null);
  const { business, isLoading, isFetching, error, refetch } =
    useBusinessDetail(businessId);
  const { status, visits, history } = useBusinessDetailResources(
    businessId,
    Boolean(business),
  );
  const sync = useBusinessInsightSync(business, refetch);
  const handleBack = useNavigateBack("/admin-panel/businesses");
  useApiErrorNotification(error, {
    toastId: "business-detail-load-error",
    fallbackMessage: "Unable to refresh business details. Please retry.",
  });
  useApiErrorNotification(status.error, {
    toastId: "business-detail-status-error",
  });
  useApiErrorNotification(visits.error, {
    toastId: "business-detail-visits-error",
  });
  useApiErrorNotification(history.error, {
    toastId: "business-detail-history-error",
  });
  const hasBusiness = Boolean(business);
  useEffect(() => {
    if (!hasBusiness || !hero.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContext(
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 64,
        );
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(hero.current);
    return () => observer.disconnect();
  }, [hasBusiness]);

  const displayedBusiness =
    business && status.data
      ? { ...business, status: status.data.status }
      : business;
  const actionBusiness = displayedBusiness
    ? {
        id: displayedBusiness.id,
        name: displayedBusiness.business_name,
        status: displayedBusiness.status,
        application_id: displayedBusiness.application?.id ?? null,
      }
    : null;
  function refreshPage() {
    void refetch();
    void status.refetch();
    void visits.refetch();
    void history.refetch();
  }
  return (
    <>
      {/* Sticky identity overlays scrolling content without shifting the observed hero */}
      {showContext && displayedBusiness && (
        <div className="sticky top-16 z-30 h-0">
          <BusinessDetailContextBar business={displayedBusiness} />
        </div>
      )}
      <DetailPageLayout
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management", href: "/admin-panel/businesses" },
          { label: "Businesses", href: "/admin-panel/businesses" },
          { label: business?.business_name || "Business" },
        ]}
        title="Business Details"
        headerActions={
          displayedBusiness && (
            <>
              {isFetching && (
                <p role="status" className="text-xs text-text-secondary">
                  Refreshing business details…
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={refreshPage}
                disabled={isFetching}
              >
                Refresh business
              </Button>
            </>
          )
        }
        backLabel="Back to Businesses"
        onBack={handleBack}
        isLoading={isLoading}
        error={!business ? error : null}
        hasData={hasBusiness}
        onRetry={refetch}
        loadingContent={<BusinessDetailSkeleton />}
        errorTitle="Business unavailable"
        errorMessage="The business details could not be loaded. Please try again."
      >
        {displayedBusiness && (
          <div className="min-w-0 space-y-6 sm:space-y-8">
            {/* Business identity and retained-content refresh feedback */}
            {error && (
              <DataErrorState
                compact
                title="Business refresh failed"
                message="The last successfully loaded details remain visible."
                onRetry={refetch}
                retrying={isFetching}
              />
            )}
            <div ref={hero}>
              <BusinessDetailHero
                business={displayedBusiness}
                statusInfo={status}
                onOpenLocation={() => setLocationOpen(true)}
                actions={
                  <BusinessRowActions
                    business={actionBusiness}
                    showViewBusiness={false}
                    onManageStatus={(_, selectedOperation) =>
                      setOperation(selectedOperation)
                    }
                  />
                }
              />
            </div>
            {/* Engagement metrics */}
            <section aria-labelledby="business-engagement">
              <h2
                id="business-engagement"
                className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary"
              >
                Business Engagement
              </h2>
              <BusinessDetailMetrics business={business} visits={visits} />
            </section>
            {/* Authoritative rating and recent-review insights */}
            <ReviewInsightsCard
              business={business}
              syncState={sync.state}
              onObserve={sync.observe}
            />
            {/* Bounded reviews and photo inspection */}
            <section aria-labelledby="business-reviews-photos">
              <h2
                id="business-reviews-photos"
                className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary"
              >
                Recent Reviews & Photo Gallery
              </h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-3">
                  <BusinessReviewsPreview
                    reviews={business.latest_reviews}
                    businessId={business.id}
                    totalReviews={business.total_review_count}
                  />
                </div>
                <div className="min-w-0 self-start lg:col-span-2">
                  <BusinessPhotosPreview
                    photos={business.photos}
                    businessName={business.business_name}
                  />
                </div>
              </div>
            </section>
            {/* Protected administrative provenance and existing request workflows */}
            <BusinessAdministrativeHistory
              businessId={business.id}
              history={history}
            />
            <BusinessApplicationSummary application={business.application} />
          </div>
        )}
      </DetailPageLayout>
      {/* Shared inspection and status dialogs */}
      {business && locationOpen && (
        <BusinessLocationModal
          isOpen
          onClose={() => setLocationOpen(false)}
          location={business.location}
          landmarks={business.landmarks}
        />
      )}
      {actionBusiness && operation && (
        <BusinessStatusDialog
          business={actionBusiness}
          operation={operation}
          onClose={() => setOperation(null)}
        />
      )}
    </>
  );
}
