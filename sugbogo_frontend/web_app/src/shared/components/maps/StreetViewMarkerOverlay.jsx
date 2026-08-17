import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

import BusinessMapMarker from "./BusinessMapMarker";

/**
 * Renders a custom business or landmark marker inside Google Street View.
 *
 * Keeps the marker anchored to its submitted geographic coordinates and
 * displays the live straight-line distance from the current Street View
 * panorama position to that coordinate.
 */
export default function StreetViewMarkerOverlay({
  position,
  variant,
  name,
  onClick,
}) {
  const map = useMap();
  const streetViewLibrary = useMapsLibrary("streetView");

  const overlayRef = useRef(null);
  const clickHandlerRef = useRef(onClick);

  const [distance, setDistance] = useState(null);

  // Create the DOM container used by the Google Maps overlay.
  const container = useMemo(() => {
    const element = document.createElement("div");

    element.style.position = "absolute";
    element.style.transform = "translate(-50%, -100%)";
    element.style.cursor = "pointer";
    element.style.zIndex = "10";

    return element;
  }, []);

  useEffect(() => {
    clickHandlerRef.current = onClick;
  }, [onClick]);

  // Calculate the straight-line distance between two coordinates.
  function calculateDistanceMeters(from, to) {
    const earthRadius = 6371000;

    const fromLatitude = typeof from.lat === "function" ? from.lat() : from.lat;
    const fromLongitude =
      typeof from.lng === "function" ? from.lng() : from.lng;

    const toLatitude = typeof to.lat === "function" ? to.lat() : to.lat;
    const toLongitude = typeof to.lng === "function" ? to.lng() : to.lng;

    const latitudeDifference = ((toLatitude - fromLatitude) * Math.PI) / 180;

    const longitudeDifference = ((toLongitude - fromLongitude) * Math.PI) / 180;

    const latitude1 = (fromLatitude * Math.PI) / 180;
    const latitude2 = (toLatitude * Math.PI) / 180;

    const a =
      Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(longitudeDifference / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }

  // Format the distance for a compact Street View badge.
  function formatDistance(distanceMeters) {
    if (distanceMeters == null) {
      return null;
    }

    if (distanceMeters < 1) {
      return "< 1 m";
    }

    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    }

    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  useEffect(() => {
    if (!map || !streetViewLibrary) {
      return;
    }

    const panorama = map.getStreetView();

    if (!panorama) {
      return;
    }

    const OverlayView = streetViewLibrary.OverlayView;

    if (!OverlayView) {
      return;
    }

    const overlay = new OverlayView();

    // Update the displayed distance from the current Street View position.
    function updateDistance() {
      const panoramaPosition = panorama.getPosition();

      if (!panoramaPosition) {
        setDistance(null);
        return;
      }

      const distanceMeters = calculateDistanceMeters(
        panoramaPosition,
        position,
      );

      setDistance(distanceMeters);
    }

    // Handle clicks on the custom Street View marker.
    function handleClick(event) {
      event.stopPropagation();
      clickHandlerRef.current?.();
    }

    // Add the marker element to the Street View overlay layer.
    overlay.onAdd = () => {
      const panes = overlay.getPanes();

      if (!panes) {
        return;
      }

      panes.overlayMouseTarget.appendChild(container);

      OverlayView.preventMapHitsAndGesturesFrom(container);

      container.addEventListener("click", handleClick);
    };

    // Reposition the marker whenever Street View redraws the overlay.
    overlay.draw = () => {
      const projection = overlay.getProjection();

      if (!projection) {
        return;
      }

      const pixelPosition = projection.fromLatLngToDivPixel(position);

      if (!pixelPosition) {
        container.style.display = "none";
        return;
      }

      container.style.display = "block";
      container.style.left = `${pixelPosition.x}px`;
      container.style.top = `${pixelPosition.y}px`;
    };

    // Clean up the overlay and its event listeners.
    overlay.onRemove = () => {
      container.removeEventListener("click", handleClick);

      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    overlayRef.current = overlay;

    // Initialize the distance for the current panorama.
    updateDistance();

    // Update the distance whenever the administrator moves to another
    // Street View panorama.
    const positionListener = panorama.addListener(
      "position_changed",
      updateDistance,
    );

    // Attach this overlay directly to the Street View panorama.
    overlay.setMap(panorama);

    return () => {
      positionListener.remove();

      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, streetViewLibrary, container, position]);

  const formattedDistance = formatDistance(distance);

  return createPortal(
    <>
      {/* Custom Street View marker */}
      <BusinessMapMarker variant={variant} />

      {/* Distance from the current Street View position */}
      {formattedDistance && (
        <div
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-lg border border-white/80 bg-black/75 px-2.5 py-1.5 text-center text-white shadow-sm"
          aria-label={`${name}, ${formattedDistance} away`}
        >
          <p className="max-w-[180px] truncate text-[11px] font-semibold">
            {name}
          </p>

          <p className="mt-0.5 text-[10px] font-medium text-white/75">
            {formattedDistance} away
          </p>
        </div>
      )}
    </>,
    container,
  );
}
