import {
  AdvancedMarker,
  ControlPosition,
  Map,
  MapControl,
  Polyline,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

const CEBU_CITY_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

const POINT_ROLE_STYLES = {
  origin: "border-success bg-success text-white",
  destination: "border-danger bg-danger text-white",
  intermediate: "border-info bg-info text-white",
  available: "border-info bg-background text-text-primary",
};

function getPointRole(
  pointId,
  originId,
  destinationId,
  intermediatePointIds,
) {
  const normalizedId = String(pointId);

  if (normalizedId === originId) {
    return "origin";
  }
  if (normalizedId === destinationId) {
    return "destination";
  }
  if (intermediatePointIds.includes(normalizedId)) {
    return "intermediate";
  }

  return "available";
}

/**
 * Renders controlled route geometry and separately selectable Transit Point markers.
 */
export default function RouteVariantMapWorkspace({
  geometry,
  transitPoints,
  originId,
  destinationId,
  intermediatePointIds,
  isDrawing,
  onAddGeometryVertex,
  onMoveGeometryVertex,
  onTransitPointSelect,
}) {
  const firstGeometryCoordinate = geometry[0];
  const originPoint = transitPoints.find(
    (point) => String(point.id) === originId,
  );
  const initialCenter = firstGeometryCoordinate
    ? {
        lat: firstGeometryCoordinate.latitude,
        lng: firstGeometryCoordinate.longitude,
      }
    : originPoint
      ? {
          lat: Number(originPoint.latitude),
          lng: Number(originPoint.longitude),
        }
      : CEBU_CITY_CENTER;
  const polylinePath = geometry.map((coordinate) => ({
    lat: Number(coordinate.latitude),
    lng: Number(coordinate.longitude),
  }));

  function handleMapClick(event) {
    if (!isDrawing || !event.detail.latLng) {
      return;
    }

    onAddGeometryVertex({
      latitude: event.detail.latLng.lat,
      longitude: event.detail.latLng.lng,
    });
  }

  function handleVertexDragEnd(index, event) {
    const position = event.latLng?.toJSON();

    if (position) {
      onMoveGeometryVertex(index, {
        latitude: position.lat,
        longitude: position.lng,
      });
    }
  }

  return (
    <div className="relative h-[68vh] min-h-[520px] overflow-hidden rounded-xl border border-stroke-strong bg-surface">
      {/* Route editor map */}
      <Map
        defaultCenter={initialCenter}
        defaultZoom={geometry.length ? 15 : 13}
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl
        clickableIcons={false}
        gestureHandling="greedy"
        draggableCursor={isDrawing ? "crosshair" : undefined}
        onClick={handleMapClick}
      >
        {/* Route LineString preview */}
        {polylinePath.length >= 2 && (
          <Polyline
            path={polylinePath}
            strokeColor="#F27F0D"
            strokeOpacity={0.9}
            strokeWeight={5}
            clickable={false}
          />
        )}

        {/* Editable geometry vertices */}
        {polylinePath.map((position, index) => (
          <AdvancedMarker
            key={`geometry-${index}`}
            position={position}
            title={`Route geometry vertex ${index + 1}`}
            draggable
            zIndex={1000 + index}
            onDragEnd={(event) => handleVertexDragEnd(index, event)}
          >
            <div className="flex h-6 w-6 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-[9px] font-bold text-white shadow-md">
              {index + 1}
            </div>
          </AdvancedMarker>
        ))}

        {/* Managed Transit Point markers */}
        {transitPoints.map((point) => {
          const role = getPointRole(
            point.id,
            originId,
            destinationId,
            intermediatePointIds,
          );

          return (
            <AdvancedMarker
              key={`transit-point-${point.id}`}
              position={{
                lat: Number(point.latitude),
                lng: Number(point.longitude),
              }}
              title={`${point.name} · ${role}`}
              clickable
              zIndex={role === "available" ? 100 : 500}
              onClick={() => onTransitPointSelect(String(point.id))}
            >
              <div
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-2.5 py-1.5 text-xs font-semibold shadow-md ${POINT_ROLE_STYLES[role]}`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-32 truncate">{point.name}</span>
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Map interaction status */}
        <MapControl position={ControlPosition.TOP_LEFT}>
          <div className="m-3 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            <p className="text-xs font-semibold text-text-primary">
              {isDrawing ? "Drawing route geometry" : "Map inspection mode"}
            </p>
            <p className="mt-1 max-w-56 text-xs leading-relaxed text-text-secondary">
              {isDrawing
                ? "Click the map to add LineString vertices in travel order."
                : "Drag numbered vertices or select named Transit Points."}
            </p>
          </div>
        </MapControl>

        {/* Map legend */}
        <MapControl position={ControlPosition.LEFT_BOTTOM}>
          <div className="m-3 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold text-text-primary">
              Map Legend
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-text-secondary">
              <LegendItem className="bg-primary" label="Geometry vertex" />
              <LegendItem className="bg-success" label="Origin" />
              <LegendItem className="bg-danger" label="Destination" />
              <LegendItem className="bg-info" label="Route Transit Point" />
            </div>
          </div>
        </MapControl>
      </Map>
    </div>
  );
}

/**
 * Displays one compact visual key for the route editor map legend.
 */
function LegendItem({ className, label }) {
  return (
    <div className="flex items-center gap-2">
      {/* Legend symbol */}
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}
