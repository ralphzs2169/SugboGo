import { useEffect, useState, Fragment } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  InfoWindow,
  Map,
  MapControl,
  useMap,
} from "@vis.gl/react-google-maps";

import BusinessMapMarker from "./BusinessMapMarker";
import StreetViewMarkerOverlay from "./StreetViewMarkerOverlay";

/**
 * Displays a read-only interactive map for a submitted business location.
 *
 * Allows administrators to pan, zoom, inspect the submitted location,
 * and inspect the same business and landmark markers while using
 * Google Street View.
 */
export default function BusinessLocationMap({
  latitude,
  longitude,
  landmarks = [],
  className = "h-72",
  focusPosition,
  selectedLandmarkId,
}) {
  const map = useMap();

  const [selectedMarker, setSelectedMarker] = useState(null);
  const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

  if (latitude == null || longitude == null) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-stroke bg-surface-muted ${className}`}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            Map location unavailable
          </p>

          <p className="mt-1 text-sm text-text-secondary">
            No valid coordinates were submitted for this application.
          </p>
        </div>
      </div>
    );
  }

  const businessPosition = {
    lat: Number(latitude),
    lng: Number(longitude),
  };

  // Center the map on a selected landmark unless Street View is active.

  useEffect(() => {
    if (!map || !focusPosition) {
      return;
    }

    const streetView = map.getStreetView();

    if (streetView?.getVisible()) {
      return;
    }

    map.panTo(focusPosition);
    map.setZoom(17);
  }, [map, focusPosition]);

  function handleMarkerClick(marker) {
    setSelectedMarker(marker);
  }

  // Select the corresponding map marker when a landmark is selected from the list.
  useEffect(() => {
    if (!selectedLandmarkId) {
      return;
    }

    const landmark = landmarks.find(
      (landmark) => landmark.id === selectedLandmarkId,
    );

    if (!landmark) {
      return;
    }

    const position = {
      lat: Number(landmark.latitude),
      lng: Number(landmark.longitude),
    };

    setSelectedMarker({
      type: "landmark",
      name: landmark.name,
      address: landmark.address,
      position,
      source: landmark.source,
    });
  }, [selectedLandmarkId, landmarks]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-stroke ${className}`}
    >
      <Map
        defaultCenter={businessPosition}
        defaultZoom={17}
        mapId={GOOGLE_MAP_ID}
        streetViewControl={true}
      >
        {/* Map legend */}
        <MapControl position={ControlPosition.LEFT_BOTTOM}>
          <div className="mb-2 ml-2 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold text-text-primary">
              Map Legend
            </p>

            <div className="space-y-1.5">
              {/* Business location */}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full bg-primary ring-1 ring-white" />
                <span className="text-xs text-text-secondary">
                  Business location
                </span>
              </div>

              {/* Google landmark */}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#4285F4] ring-1 ring-white" />
                <span className="text-xs text-text-secondary">
                  Suggested landmark
                </span>
              </div>

              {/* Custom landmark */}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#16A34A] ring-1 ring-white" />
                <span className="text-xs text-text-secondary">
                  Custom landmark
                </span>
              </div>
            </div>
          </div>
        </MapControl>

        {/* Business location */}
        <AdvancedMarker
          position={businessPosition}
          title="Business location"
          onClick={() =>
            handleMarkerClick({
              type: "business",
              name: "Business Location",
              address: "Submitted business location",
              position: businessPosition,
            })
          }
        >
          <BusinessMapMarker variant="business" />
        </AdvancedMarker>

        {/* Business location in Street View */}
        <StreetViewMarkerOverlay
          position={businessPosition}
          variant="business"
          name="Business Location"
          onClick={() =>
            handleMarkerClick({
              type: "business",
              name: "Business Location",
              address: "Submitted business location",
              position: businessPosition,
            })
          }
        />

        {/* Submitted landmarks */}
        {landmarks.map((landmark) => {
          const position = {
            lat: Number(landmark.latitude),
            lng: Number(landmark.longitude),
          };

          const variant = landmark.source === "google" ? "google" : "custom";

          return (
            <Fragment key={landmark.id}>
              {/* Map marker */}
              <AdvancedMarker
                position={position}
                title={landmark.name}
                onClick={() =>
                  handleMarkerClick({
                    type: "landmark",
                    name: landmark.name,
                    address: landmark.address,
                    position,
                  })
                }
              >
                <BusinessMapMarker variant={variant} />
              </AdvancedMarker>

              {/* Street View marker */}
              <StreetViewMarkerOverlay
                position={position}
                variant={variant}
                name={landmark.name}
                onClick={() =>
                  handleMarkerClick({
                    type: "landmark",
                    name: landmark.name,
                    address: landmark.address,
                    position,
                  })
                }
              />
            </Fragment>
          );
        })}

        {/* Selected marker information */}
        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            pixelOffset={[0, -20]}
            onCloseClick={() => setSelectedMarker(null)}
            className="!p-0"
          >
            <div className="max-w-xs px-1 py-0">
              <p className="text-sm font-semibold text-gray-900">
                {selectedMarker.name}
              </p>

              {selectedMarker.type === "business" ? (
                <p className="mt-1 text-xs text-gray-600">
                  Submitted business location
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-600">
                  {selectedMarker.source === "google"
                    ? selectedMarker.address || "No address provided."
                    : "Custom landmark"}
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}
