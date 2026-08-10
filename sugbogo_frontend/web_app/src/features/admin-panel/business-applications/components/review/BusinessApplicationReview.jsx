import ApplicationReviewHeader from "./ApplicationReviewHeader";
import BusinessDocumentsReview from "./BusinessDocumentsReview";
import BusinessHoursReview from "./BusinessHoursReview";
import BusinessIdentityReview from "./BusinessIdentityReview";
import BusinessLocationReview from "./BusinessLocationReview";
import BusinessPhotosReview from "./BusinessPhotosReview";
import GoogleMapsProvider from "../../../providers/GoogleMapsProvider";
import ApplicationReviewContextBar from "./ReviewContextBar";
import { useEffect, useRef, useState } from "react";

/**
 * Composes the submitted merchant application into the complete
 * administrative review workspace.
 *
 * Keeps page-level data loading separate from the individual
 * application review sections.
 */
export default function BusinessApplicationReview({ application }) {
  const reviewHeaderRef = useRef(null);
  const [showContextBar, setShowContextBar] = useState(false);

  const businessName =
    application.identity?.business_name || "Unnamed Business";

  useEffect(() => {
    const header = reviewHeaderRef.current;

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
  }, []);

  return (
    <div className="space-y-6">
      {/* Compact context bar */}
      {showContextBar && (
        <ApplicationReviewContextBar application={application} />
      )}

      {/* Application header */}
      <div ref={reviewHeaderRef}>
        <ApplicationReviewHeader application={application} />
      </div>

      {/* Business identity */}
      <BusinessIdentityReview identity={application.identity} />

      {/* Business location */}
      <GoogleMapsProvider>
        <BusinessLocationReview location={application.location} />
      </GoogleMapsProvider>

      {/* Operating hours */}
      <BusinessHoursReview operatingHours={application.operating_hours} />

      {/* Business photos */}
      <BusinessPhotosReview photos={application.photos} />

      {/* Verification documents */}
      <BusinessDocumentsReview documents={application.documents} />

      {/* Decision area */}
      <section className="rounded-xl border border-stroke bg-surface p-6">
        <h2 className="text-base font-semibold text-text-primary">
          Review Decision
        </h2>

        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Verify that the submitted information and supporting evidence meet
          SugboGo&apos;s requirements before approving this application.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-stroke-strong px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            Reject Application
          </button>

          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Approve Application
          </button>
        </div>
      </section>
    </div>
  );
}
