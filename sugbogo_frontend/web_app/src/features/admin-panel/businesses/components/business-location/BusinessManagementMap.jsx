import { GoogleMapsAuthContext } from "@/shared/utils/googleMapsAuthContext";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ControlPosition,
  Map,
  MapControl,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
} from "@vis.gl/react-google-maps";
import BusinessMapInfoWindow from "./BusinessMapInfoWindow";
import BusinessMapClusters from "./BusinessMapClusters";
import AnchoredMapPopup from "./AnchoredMapPopup";
import BusinessMapChooser from "./BusinessMapChooser";

const DEFAULT_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

const DEFAULT_ZOOM = 12;

const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

/**
 * Displays an interactive geographic overview of registered businesses.
 *
 * Automatically fits the map to the available business locations and lets
 * administrators inspect a business marker before opening its management view.
 */
export default function BusinessManagementMap({
  businesses = [],
  isLoading = false,
  isFetching = false,
  error = null,
  onRetry,
  onViewBusiness,
  hasActiveFilters = false,
  onResetFilters,
  className = "h-[480px]",
}) {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();
  const authFailed = useContext(GoogleMapsAuthContext);
  const [selectedId, setSelectedId] = useState(null);
  const [overlapIds, setOverlapIds] = useState([]);
  const selectedBusiness = businesses.find(
    (business) => business.id === selectedId,
  );
  const overlappingBusinesses = businesses.filter((item) =>
    overlapIds.includes(item.id),
  );
  const onOverlap = useCallback((items) => {
    setSelectedId(null);
    setOverlapIds(items.map((item) => item.id));
  }, []);
  const closePopup = useCallback(() => {
    setSelectedId(null);
    setOverlapIds([]);
  }, []);

  const businessesWithCoordinates = useMemo(
    () =>
      businesses.filter(
        (business) =>
          business.latitude != null &&
          business.longitude != null &&
          Number.isFinite(Number(business.latitude)) &&
          Number.isFinite(Number(business.longitude)),
      ),
    [businesses],
  );

  useEffect(() => {
    if (!map || businessesWithCoordinates.length === 0) {
      return;
    }

    if (businessesWithCoordinates.length === 1) {
      map.setCenter({
        lat: Number(businessesWithCoordinates[0].latitude),
        lng: Number(businessesWithCoordinates[0].longitude),
      });
      map.setZoom(15);

      return;
    }

    const bounds = new globalThis.google.maps.LatLngBounds();

    businessesWithCoordinates.forEach((business) => {
      bounds.extend({
        lat: Number(business.latitude),
        lng: Number(business.longitude),
      });
    });

    map.fitBounds(bounds, 60);
  }, [map, businessesWithCoordinates]);

  useEffect(() => {
    if (
      selectedId !== null &&
      !businesses.some((item) => item.id === selectedId)
    ) {
      // A removed result must not regain selection if a later query contains it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(null);
    }
  }, [businesses, selectedId]);

  useEffect(() => {
    if (
      overlapIds.some(
        (id) => !businesses.some((business) => business.id === id),
      )
    ) {
      // Keep removed choices from reappearing after a later filter change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverlapIds((current) =>
        current.filter((id) =>
          businesses.some((business) => business.id === id),
        ),
      );
    }
  }, [businesses, overlapIds]);

  function handleMarkerClick(business) {
    setSelectedId(business.id);
    setOverlapIds([]);
  }

  function handleViewBusiness() {
    if (!selectedBusiness || !onViewBusiness) {
      return;
    }

    onViewBusiness(selectedBusiness);
  }

  if (authFailed || loadingStatus === APILoadingStatus.FAILED) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-center bg-surface-muted text-sm text-text-secondary ${className}`}
      >
        Google Maps could not initialize. Business data may still be available
        in the Businesses tab.
      </div>
    );
  }

  if (isLoading)
    return (
      <div
        role="status"
        className={`animate-pulse rounded-lg bg-surface-muted ${className}`}
      >
        Loading business locations…
      </div>
    );

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-stroke bg-surface-muted ${className}`}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            Unable to load business locations
          </p>

          <p className="mt-1 text-sm text-text-secondary">
            The business location map could not be loaded.
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-2 border-stroke ${className}`}
    >
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId={GOOGLE_MAP_ID}
        streetViewControl={false}
        fullscreenControl={true}
        mapTypeControl={false}
        onClick={closePopup}
      >
        {/* Business markers */}
        <BusinessMapClusters
          businesses={businessesWithCoordinates}
          selectedId={selectedBusiness?.id}
          onSelect={handleMarkerClick}
          onOverlap={onOverlap}
        />
        {overlappingBusinesses.length > 1 && (
          <AnchoredMapPopup
            position={{
              lat: Number(overlappingBusinesses[0].latitude),
              lng: Number(overlappingBusinesses[0].longitude),
            }}
            title="Choose a business"
            width={392}
            onClose={closePopup}
          >
            <BusinessMapChooser
              businesses={overlappingBusinesses}
              selectedId={selectedId}
              onSelect={handleMarkerClick}
            />
          </AnchoredMapPopup>
        )}
        {/* Selected business information shares the same coordinate-anchored shell. */}
        {selectedBusiness && (
          <AnchoredMapPopup
            key={selectedBusiness.id}
            position={{
              lat: Number(selectedBusiness.latitude),
              lng: Number(selectedBusiness.longitude),
            }}
            onClose={closePopup}
          >
            <BusinessMapInfoWindow
              business={selectedBusiness}
              onView={handleViewBusiness}
            />
          </AnchoredMapPopup>
        )}

        {/* Map status */}
        <MapControl position={ControlPosition.TOP_LEFT}>
          <div className="m-3 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            {/* <p className="text-xs font-semibold text-text-primary">
              Business Locations
            </p> */}

            <p className="mt-0.5 text-xs text-text-primary">
              {isLoading
                ? "Loading businesses..."
                : isFetching
                  ? "Updating..."
                  : `${businessesWithCoordinates.length} ${
                      businessesWithCoordinates.length === 1
                        ? "business"
                        : "businesses"
                    }`}
            </p>
          </div>
        </MapControl>

        {/* Empty map state */}
        {!isLoading && businessesWithCoordinates.length === 0 && (
          <MapControl position={ControlPosition.CENTER}>
            <div className="rounded-lg border border-stroke bg-background/95 px-5 py-4 text-center shadow-md backdrop-blur-sm">
              <p className="text-sm font-medium text-text-primary">
                {hasActiveFilters
                  ? "No businesses match your search"
                  : "No business locations available"}
              </p>

              <p className="mt-1 text-xs text-text-secondary">
                {hasActiveFilters
                  ? "Try adjusting your search or status filter."
                  : "Businesses with valid coordinates will appear here."}
              </p>

              {hasActiveFilters && onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="mt-3 cursor-pointer text-sm font-semibold text-primary hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          </MapControl>
        )}
      </Map>
    </div>
  );
}
