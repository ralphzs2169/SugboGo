import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  InfoWindow,
  Map,
  MapControl,
  useAdvancedMarkerRef,
  useMap,
} from "@vis.gl/react-google-maps";

import BusinessMapMarker from "@/shared/components/maps/BusinessMapMarker";
import StreetViewMarkerOverlay from "./StreetViewMarkerOverlay";
import useGoogleMapTheme from "@/shared/hooks/useGoogleMapTheme";

/**
 * Displays a read-only interactive map for a business location.
 *
 * Supports business and landmark markers, marker-focused InfoWindows,
 * landmark selection from the surrounding interface, and Google
 * Street View inspection.
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

  const hasValidCoordinates = latitude != null && longitude != null;

  const businessPosition = useMemo(
    () => {
      if (!hasValidCoordinates) {
        return null;
      }

      return {
        lat: Number(latitude),
        lng: Number(longitude),
      };
    },
    [hasValidCoordinates, latitude, longitude],
  );
  const mapTheme = useGoogleMapTheme({
    center: businessPosition,
    zoom: 17,
  });
  const focusedPosition = useRef(null);

  // Center the map on a selected landmark unless Street View is active.
  useEffect(() => {
    if (!map || focusedPosition.current === focusPosition) {
      return;
    }

    if (!focusPosition) {
      focusedPosition.current = focusPosition;
      return;
    }

    const streetView = map.getStreetView();

    if (streetView?.getVisible()) {
      return;
    }

    focusedPosition.current = focusPosition;
    map.panTo(focusPosition);
    map.setZoom(17);
  }, [map, focusPosition]);

  // Recalculate the map layout after it receives its real modal dimensions.
  useEffect(() => {
    if (!map) {
      return;
    }

    const container = map.getDiv();
    let hasFixed = false;

    const observer = new ResizeObserver((entries) => {
      if (hasFixed) {
        return;
      }

      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;

      if (width > 0 && height > 0) {
        hasFixed = true;

        globalThis.google.maps.event.trigger(map, "resize");
        map.setCenter(map.getCenter());
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  // Select the corresponding marker when a landmark is selected externally.
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

    // Synchronize selection requested by the surrounding landmark controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedMarker({
      id: landmark.id,
      type: "landmark",
      name: landmark.name,
      address: landmark.address,
      position: {
        lat: Number(landmark.latitude),
        lng: Number(landmark.longitude),
      },
      source: landmark.source,
    });
  }, [selectedLandmarkId, landmarks]);

  if (!hasValidCoordinates) {
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

  function handleMarkerSelect(marker) {
    setSelectedMarker(marker);
  }

  function handleMarkerClose() {
    setSelectedMarker(null);
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-stroke ${className}`}
    >
      <Map
        {...mapTheme}
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
        <BusinessLocationMarker
          position={businessPosition}
          colorScheme={mapTheme.colorScheme}
          variant="business"
          markerData={{
            id: "business",
            type: "business",
            name: "Business Location",
            address: "Submitted business location",
            position: businessPosition,
          }}
          isSelected={selectedMarker?.id === "business"}
          onSelect={handleMarkerSelect}
          onClose={handleMarkerClose}
        />

        {/* Business location in Street View */}
        <StreetViewMarkerOverlay
          position={businessPosition}
          variant="business"
          name="Business Location"
          onClick={() =>
            handleMarkerSelect({
              id: "business",
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
              <BusinessLocationMarker
                position={position}
                colorScheme={mapTheme.colorScheme}
                variant={variant}
                title={landmark.name}
                markerData={{
                  id: landmark.id,
                  type: "landmark",
                  name: landmark.name,
                  address: landmark.address,
                  position,
                  source: landmark.source,
                }}
                isSelected={selectedMarker?.id === landmark.id}
                onSelect={handleMarkerSelect}
                onClose={handleMarkerClose}
              />

              {/* Street View marker */}
              <StreetViewMarkerOverlay
                position={position}
                variant={variant}
                name={landmark.name}
                onClick={() =>
                  handleMarkerSelect({
                    id: landmark.id,
                    type: "landmark",
                    name: landmark.name,
                    address: landmark.address,
                    position,
                    source: landmark.source,
                  })
                }
              />
            </Fragment>
          );
        })}
      </Map>
    </div>
  );
}

/**
 * Keeps an AdvancedMarker paired with its own InfoWindow anchor.
 *
 * This ensures clicking a marker opens the InfoWindow on the exact
 * marker that was selected rather than relying on coordinate-based
 * positioning.
 */
function BusinessLocationMarker({
  position,
  colorScheme,
  variant,
  title,
  markerData,
  isSelected,
  onSelect,
  onClose,
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [popupTheme, setPopupTheme] = useState({
    colorScheme,
    preserveCamera: false,
  });

  if (
    popupTheme.colorScheme !== colorScheme ||
    (!isSelected && popupTheme.preserveCamera)
  ) {
    setPopupTheme({
      colorScheme,
      preserveCamera: isSelected,
    });
  }

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={title}
        onClick={() => onSelect(markerData)}
      >
        <BusinessMapMarker variant={variant} />
      </AdvancedMarker>

      {/* Marker information */}
      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={onClose}
          // Reopening a selected popup after a theme change must not pan again.
          disableAutoPan={popupTheme.preserveCamera}
        >
          <div className="max-w-xs px-1 py-0">
            <p className="text-sm font-semibold text-gray-900">
              {markerData.name}
            </p>

            {markerData.type === "business" ? (
              <p className="mt-1 text-xs text-gray-600">
                Submitted business location
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-600">
                {markerData.source === "google"
                  ? markerData.address || "No address provided"
                  : "Custom landmark"}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}
