import { useState, Fragment } from "react";
import { AdvancedMarker, InfoWindow, Map } from "@vis.gl/react-google-maps";

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
}) {
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

  function handleMarkerClick(marker) {
    setSelectedMarker(marker);
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-stroke ${className}`}
    >
      <Map
        defaultCenter={businessPosition}
        defaultZoom={17}
        mapId={GOOGLE_MAP_ID}
      >
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
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="max-w-xs">
              <p className="text-sm font-semibold text-gray-900">
                {selectedMarker.name}
              </p>

              {selectedMarker.type === "business" ? (
                <p className="mt-1 text-xs text-gray-600">
                  Submitted business location
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-600">
                  {selectedMarker.address || "No address provided."}
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}
