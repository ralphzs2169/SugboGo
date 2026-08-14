import { useState } from "react";
import { MapPin } from "lucide-react";

import ApplicationReviewField from "./ApplicationReviewField";
import ApplicationReviewSection from "./ApplicationReviewSection";
import BusinessLocationMap from "./business-location/BusinessLocationMap";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
import ApplicationReviewChangeStatus from "./ApplicationReviewChangeStatus";
/**
 * Displays the submitted business location and nearby landmarks
 * for administrative verification.
 */
export default function BusinessLocationReview({
  location,
  feedback,
  isChangedSinceLastReview = false,
  isResubmission,
}) {
  const [focusPosition, setFocusPosition] = useState(null);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState(null);

  function handleLandmarkClick(landmark) {
    setFocusPosition({
      lat: Number(landmark.latitude),
      lng: Number(landmark.longitude),
    });
  }

  return (
    <ApplicationReviewSection
      icon={MapPin}
      title="Business Location"
      description="Verify the submitted address, map position, and nearby landmarks."
    >
      <ApplicationReviewChangeStatus
        feedback={feedback}
        isChangedSinceLastReview={isChangedSinceLastReview}
        isResubmission={isResubmission}
      />

      <ApplicationReviewFeedback
        feedback={feedback}
        isResubmission={isResubmission}
      />
      {!location ? (
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            No business location information was submitted.
          </h3>

          <p className="mt-1 text-sm text-text-secondary">
            The applicant did not provide location information for this
            application.
          </p>
        </div>
      ) : (
        <>
          {/* Address information */}
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ApplicationReviewField label="City" value={location.city} />

            <ApplicationReviewField
              label="Barangay"
              value={location.barangay}
            />

            <ApplicationReviewField label="Unit" value={location.unit} />

            <ApplicationReviewField
              label="Street Address"
              value={location.street_address}
              className="md:col-span-2"
            />
          </dl>

          {/* Map and landmarks */}
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-stroke pt-6 lg:grid-cols-2 lg:items-stretch">
            {/* Business location map */}
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-text-primary">
                Map Location
              </h3>

              <p className="mt-1 text-sm text-text-secondary">
                Inspect the submitted business location and nearby landmarks.
              </p>

              <div className="mt-5 min-h-[320px] flex-1">
                <BusinessLocationMap
                  latitude={location.latitude}
                  longitude={location.longitude}
                  landmarks={location.landmarks}
                  focusPosition={focusPosition}
                  selectedLandmarkId={selectedLandmarkId}
                  className="h-full min-h-[320px]"
                />
              </div>
            </div>

            {/* Nearby landmarks */}
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-text-primary">
                Nearby Landmarks
              </h3>

              <p className="mt-1 text-sm text-text-secondary">
                Landmarks submitted to help identify the business location.
              </p>

              {location.landmarks?.length ? (
                <div className="mt-5 min-h-[320px] flex-1 divide-y divide-stroke overflow-y-auto rounded-lg border border-stroke">
                  {location.landmarks.map((landmark) => (
                    <button
                      key={landmark.id}
                      type="button"
                      onClick={() => {
                        setSelectedLandmarkId(landmark.id);

                        setFocusPosition({
                          lat: Number(landmark.latitude),
                          lng: Number(landmark.longitude),
                        });
                      }}
                      className="flex w-full cursor-pointer gap-3 px-4 py-4 text-left transition-colors hover:bg-interaction-hover"
                    >
                      <MapPin
                        size={18}
                        strokeWidth={1.8}
                        className="mt-0.5 shrink-0 text-text-secondary"
                      />

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {landmark.name}
                        </p>

                        {landmark.source === "custom" && (
                          <p className="mt-1 text-xs text-text-secondary">
                            Custom Landmark
                          </p>
                        )}

                        {landmark.source === "google" && (
                          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                            {landmark.address ?? "No address provided"}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-stroke bg-surface-muted p-5 text-center">
                  <MapPin
                    size={20}
                    strokeWidth={1.8}
                    className="text-text-secondary"
                  />

                  <p className="mt-3 text-sm font-medium text-text-primary">
                    No nearby landmarks submitted
                  </p>

                  <p className="mt-1 text-sm text-text-secondary">
                    The applicant did not provide any nearby landmarks.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </ApplicationReviewSection>
  );
}
