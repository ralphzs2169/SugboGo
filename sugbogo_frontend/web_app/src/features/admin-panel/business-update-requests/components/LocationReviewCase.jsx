import { useMemo } from "react";
import { AlertTriangle, MapPin } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";
import { getLandmarkDiff } from "../utils/locationDiff";
import { validLocationPosition } from "../utils/locationMapMarkers";
import LocationComparisonMap, {
  LocationMapBoundary,
} from "./LocationComparisonMap";
import LocationLandmarkDiff from "./LocationLandmarkDiff";
import LocationRequestedChanges from "./LocationRequestedChanges";
import LocationStateCard from "./LocationStateCard";
import UpdateRequestReason from "./UpdateRequestReason";
import UpdateRequestSidebar from "./UpdateRequestSidebar";

const LOCATION_REVIEW_CHECKLIST = [
  "Does the requested map pin correspond to the business's actual physical location?",
  "Does the submitted address match the proposed map position?",
  "Are the requested landmark changes accurate and helpful for navigation?",
  "Is the requested location within SugboGo's supported Cebu City service area?",
];

/** Keeps captured changes and Admin context inside one review card. */
export default function LocationReviewCase({ request, isStalePendingRequest }) {
  const landmarkDiff = getLandmarkDiff(
    request.previous?.landmarks,
    request.proposed?.landmarks,
  );
  const hasLandmarkChanges =
    landmarkDiff.added.length > 0 || landmarkDiff.removed.length > 0;
  const previousLocation = request.previous?.location;
  const currentLocation = request.current?.location;
  const proposedLocation = request.proposed?.location;

  const mapStates = useMemo(() => {
    const previousPosition = validLocationPosition(previousLocation);
    const currentPosition = validLocationPosition(currentLocation);
    const currentPinDiffers =
      currentPosition &&
      (!previousPosition ||
        currentPosition.lat !== previousPosition.lat ||
        currentPosition.lng !== previousPosition.lng);

    return [
      {
        id: "previous",
        label: "Previous",
        location: previousLocation,
      },
      ...(currentPinDiffers
        ? [
            {
              id: "current",
              label: "Current",
              location: currentLocation,
            },
          ]
        : []),
      {
        id: "proposed",
        label: "Requested",
        location: proposedLocation,
      },
    ];
  }, [previousLocation, currentLocation, proposedLocation]);

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Unified case header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Location Change
        </h2>
        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status] || "neutral"}
        >
          {formatLabel(request.status)}
        </StatusBadge>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        {/* Captured location changes and merchant explanation */}
        <div className="min-w-0 p-5 sm:p-6 xl:border-r xl:border-stroke">
          <div className="flex items-center gap-2 text-text-secondary">
            <MapPin size={16} aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Requested Changes
            </h3>
          </div>

          <div className="mt-5">
            <LocationRequestedChanges
              previous={request.previous?.location}
              proposed={request.proposed?.location}
              status={request.status}
            />
          </div>

          {/* Read-only Google Map and Street View comparison */}
          <div className="mt-6 border-t border-stroke pt-6">
            <h4 className="text-sm font-semibold text-text-primary">
              Location Comparison Map
            </h4>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Compare the captured pins and inspect the surrounding streets.
            </p>
            <div className="mt-4">
              <LocationMapBoundary key={request.id} states={mapStates}>
                <LocationComparisonMap states={mapStates} />
              </LocationMapBoundary>
            </div>
          </div>

          {/* Only changed landmarks are listed. */}
          {hasLandmarkChanges && (
            <div className="mt-6 border-t border-stroke pt-6">
              <LocationLandmarkDiff
                previous={request.previous?.landmarks}
                proposed={request.proposed?.landmarks}
                status={request.status}
              />
            </div>
          )}

          {/* Live values remain distinct from both historical snapshots. */}
          {isStalePendingRequest && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-start gap-3 text-amber-900">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">
                    Location information has changed
                  </p>
                  <p className="mt-1 text-sm leading-6">
                    The live location or landmarks no longer match the values
                    captured at submission. Approval will be blocked.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <LocationStateCard
                  title="Current live location"
                  snapshot={request.current}
                />
              </div>
            </div>
          )}

          <div className="my-7 flex items-center gap-3 text-xs font-medium text-text-secondary">
            <div className="h-px flex-1 bg-stroke" />
            <span>↓ requested because</span>
            <div className="h-px flex-1 bg-stroke" />
          </div>
          <UpdateRequestReason reason={request.reason} />
        </div>

        {/* Shared request information, identities, and review guidance */}
        <aside className="min-w-0 border-t border-stroke xl:border-t-0">
          <UpdateRequestSidebar
            request={request}
            checklistQuestions={LOCATION_REVIEW_CHECKLIST}
          />
        </aside>
      </div>
    </section>
  );
}
