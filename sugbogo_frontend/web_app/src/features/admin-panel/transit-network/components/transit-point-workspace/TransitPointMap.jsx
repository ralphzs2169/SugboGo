import { useEffect, useMemo } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  Map,
  MapControl,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

const CEBU_CITY_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

function toPosition(point) {
  if (!point || point.latitude === "" || point.longitude === "") {
    return null;
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    lat: latitude,
    lng: longitude,
  };
}

/**
 * Keeps the map focused on explicit selections without resetting the viewport
 * during unrelated renders, and fits newly loaded result pages when browsing.
 */
function TransitPointMapViewport({ positions, focusPosition, focusKey, mode }) {
  const map = useMap();
  const positionsKey = positions
    .map((position) => `${position.lat},${position.lng}`)
    .join("|");

  useEffect(() => {
    if (!map || !window.google?.maps || mode !== "browse") {
      return;
    }

    if (positions.length === 1) {
      map.setCenter(positions[0]);
      map.setZoom(16);
      return;
    }

    if (positions.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();

      positions.forEach((position) => bounds.extend(position));
      map.fitBounds(bounds, 64);
    }
    // positionsKey is the stable geographic identity of the current API page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, positionsKey, mode]);

  useEffect(() => {
    if (!map || !focusPosition) {
      return;
    }

    map.panTo(focusPosition);

    if ((map.getZoom() ?? 0) < 16) {
      map.setZoom(16);
    }
  }, [map, focusPosition, focusKey]);

  return null;
}

/**
 * Displays persisted Transit Points and a controlled temporary/edit marker in
 * the shared Google Maps environment used by the transit administration tools.
 */
export default function TransitPointMap({
  transitPoints,
  selectedPoint,
  selectedPointId,
  mode,
  draftPosition,
  isFetching,
  onPointSelect,
  onPositionChange,
}) {
  const displayPoints = useMemo(() => {
    if (
      !selectedPoint ||
      transitPoints.some(
        (point) => String(point.id) === String(selectedPoint.id),
      )
    ) {
      return transitPoints;
    }

    return [...transitPoints, selectedPoint];
  }, [selectedPoint, transitPoints]);
  const persistedPositions = useMemo(
    () =>
      displayPoints
        .map((point) => toPosition(point))
        .filter(Boolean),
    [displayPoints],
  );
  const focusedPosition =
    mode === "add"
      ? draftPosition
      : mode === "edit"
        ? draftPosition
        : toPosition(selectedPoint);
  const focusKey = focusedPosition
    ? `${selectedPointId ?? "draft"}-${focusedPosition.lat}-${focusedPosition.lng}`
    : null;

  function handleMapClick(event) {
    if (mode === "browse" || !event.detail.latLng) {
      return;
    }

    onPositionChange(event.detail.latLng);
  }

  function handleDraftDragEnd(event) {
    const nextPosition = event.latLng?.toJSON();

    if (nextPosition) {
      onPositionChange(nextPosition);
    }
  }

  return (
    <div className="relative h-[68vh] min-h-[540px] overflow-hidden rounded-xl border border-stroke-strong bg-surface">
      {/* Transit Point management map */}
      <Map
        defaultCenter={CEBU_CITY_CENTER}
        defaultZoom={13}
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl
        clickableIcons={false}
        gestureHandling="greedy"
        draggableCursor={mode === "browse" ? undefined : "crosshair"}
        onClick={handleMapClick}
      >
        <TransitPointMapViewport
          positions={persistedPositions}
          focusPosition={focusedPosition}
          focusKey={focusKey}
          mode={mode}
        />

        {/* Persisted Transit Point markers */}
        {displayPoints.map((point) => {
          const position = toPosition(point);
          const isSelected = String(point.id) === String(selectedPointId);
          const isLocallyEditing = mode === "edit" && isSelected;
          const canSelect = mode === "browse";

          if (!position || isLocallyEditing) {
            return null;
          }

          return (
            <AdvancedMarker
              key={point.id}
              position={position}
              title={point.name}
              clickable={canSelect}
              zIndex={isSelected ? 500 : 100}
              onClick={canSelect ? () => onPointSelect(point) : undefined}
            >
              <div
                className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1.5 text-xs font-semibold shadow-md transition-transform ${
                  canSelect ? "cursor-pointer" : "cursor-default opacity-70"
                } ${
                  isSelected
                    ? "scale-110 border-background bg-primary text-white"
                    : "border-info bg-background text-text-primary"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-36 truncate">{point.name}</span>
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Temporary or locally edited marker */}
        {draftPosition && mode !== "browse" && (
          <AdvancedMarker
            position={draftPosition}
            title={mode === "add" ? "New Transit Point" : "Edited location"}
            draggable
            zIndex={1000}
            onDragEnd={handleDraftDragEnd}
          >
            <div className="flex h-11 w-11 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-lg ring-4 ring-primary/20">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </div>
          </AdvancedMarker>
        )}

        {/* Map interaction guidance */}
        <MapControl position={ControlPosition.TOP_LEFT}>
          <div className="m-3 max-w-72 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            <p className="text-xs font-semibold text-text-primary">
              {mode === "add"
                ? draftPosition
                  ? "New point location selected"
                  : "Click the map to place a point"
                : mode === "edit"
                  ? "Editing selected point"
                  : "Transit Point map"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {mode === "browse"
                ? "Select a named marker to inspect its managed location."
                : "Click elsewhere or drag the highlighted marker to reposition it."}
            </p>
          </div>
        </MapControl>

        {/* Result-page status */}
        <MapControl position={ControlPosition.LEFT_BOTTOM}>
          <div className="m-3 rounded-lg border border-stroke bg-background/95 px-3 py-2 text-xs text-text-secondary shadow-md backdrop-blur-sm">
            {isFetching
              ? "Updating map points..."
              : `${displayPoints.length} point${displayPoints.length === 1 ? "" : "s"} visible`}
          </div>
        </MapControl>
      </Map>
    </div>
  );
}
