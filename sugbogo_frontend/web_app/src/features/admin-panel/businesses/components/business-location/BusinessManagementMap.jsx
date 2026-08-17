import { useEffect, useState } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  InfoWindow,
  Map,
  MapControl,
  useMap,
} from "@vis.gl/react-google-maps";
import BusinessMapInfoWindow from "./BusinessMapInfoWindow";
import BusinessMapMarker from "@/shared/components/maps/BusinessMapMarker";

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
  error = null,
  onRetry,
  onViewBusiness,
  className = "h-[480px]",
}) {
  const map = useMap();
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  const businessesWithCoordinates = businesses.filter(
    (business) => business.latitude != null && business.longitude != null,
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

    const bounds = new google.maps.LatLngBounds();

    businessesWithCoordinates.forEach((business) => {
      bounds.extend({
        lat: Number(business.latitude),
        lng: Number(business.longitude),
      });
    });

    map.fitBounds(bounds, 60);
  }, [map, businessesWithCoordinates]);

  function handleMarkerClick(business) {
    setSelectedBusiness(business);
  }

  function handleInfoWindowClose() {
    setSelectedBusiness(null);
  }

  function handleViewBusiness() {
    if (!selectedBusiness || !onViewBusiness) {
      return;
    }

    onViewBusiness(selectedBusiness);
  }

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
      >
        {/* Business markers */}
        {businessesWithCoordinates.map((business) => {
          const position = {
            lat: Number(business.latitude),
            lng: Number(business.longitude),
          };

          return (
            <AdvancedMarker
              key={business.id}
              position={position}
              title={business.business_name}
              onClick={() => handleMarkerClick(business)}
            >
              <BusinessMapMarker variant="business" />
            </AdvancedMarker>
          );
        })}

        {/* Selected business information */}
        {selectedBusiness && (
          <InfoWindow
            position={{
              lat: Number(selectedBusiness.latitude),
              lng: Number(selectedBusiness.longitude),
            }}
            pixelOffset={[0, -20]}
            onCloseClick={handleInfoWindowClose}
          >
            <BusinessMapInfoWindow
              business={selectedBusiness}
              onView={handleViewBusiness}
            />
          </InfoWindow>
        )}

        {/* Map status */}
        <MapControl position={ControlPosition.TOP_LEFT}>
          <div className="m-3 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            <p className="text-xs font-semibold text-text-primary">
              Business Locations
            </p>

            <p className="mt-0.5 text-xs text-text-secondary">
              {isLoading
                ? "Loading businesses..."
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
                No business locations available
              </p>

              <p className="mt-1 text-xs text-text-secondary">
                Businesses with valid coordinates will appear here.
              </p>
            </div>
          </MapControl>
        )}
      </Map>
    </div>
  );
}
