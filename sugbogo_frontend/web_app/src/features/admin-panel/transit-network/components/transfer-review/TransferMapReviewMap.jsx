import { useEffect, useMemo } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  Map,
  MapControl,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

const CEBU_CITY_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

function toMapPath(geometry = []) {
  return geometry.map((coordinate) => ({
    lat: Number(coordinate.latitude),
    lng: Number(coordinate.longitude),
  }));
}

/**
 * Fits the transfer review map to both routes and proposed connection points.
 */
function TransferMapViewport({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || !positions.length) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    positions.forEach((position) => bounds.extend(position));
    map.fitBounds(bounds, 56);
  }, [map, positions]);

  return null;
}

/**
 * Visualizes both directional routes and the proposed straight-line connection.
 */
export default function TransferMapReviewMap({
  sourceVariant,
  destinationVariant,
  alightingPoint,
  boardingPoint,
}) {
  const alightingLatitude = alightingPoint.latitude;
  const alightingLongitude = alightingPoint.longitude;
  const boardingLatitude = boardingPoint.latitude;
  const boardingLongitude = boardingPoint.longitude;
  const sourcePath = useMemo(
    () => toMapPath(sourceVariant.geometry),
    [sourceVariant.geometry],
  );
  const destinationPath = useMemo(
    () => toMapPath(destinationVariant.geometry),
    [destinationVariant.geometry],
  );
  const alightingPosition = useMemo(
    () => ({
      lat: Number(alightingLatitude),
      lng: Number(alightingLongitude),
    }),
    [alightingLatitude, alightingLongitude],
  );
  const boardingPosition = useMemo(
    () => ({
      lat: Number(boardingLatitude),
      lng: Number(boardingLongitude),
    }),
    [boardingLatitude, boardingLongitude],
  );
  const connectionPath = [alightingPosition, boardingPosition];
  const viewportPositions = useMemo(
    () => [
      ...sourcePath,
      ...destinationPath,
      alightingPosition,
      boardingPosition,
    ],
    [
      sourcePath,
      destinationPath,
      alightingPosition,
      boardingPosition,
    ],
  );

  return (
    <div className="h-[58vh] min-h-[420px] overflow-hidden rounded-xl border border-stroke-strong bg-surface">
      {/* Transfer review map */}
      <Map
        defaultCenter={alightingPosition ?? CEBU_CITY_CENTER}
        defaultZoom={14}
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl
        clickableIcons={false}
        gestureHandling="greedy"
      >
        <TransferMapViewport positions={viewportPositions} />

        {/* Directional route geometries */}
        {sourcePath.length >= 2 && (
          <Polyline
            path={sourcePath}
            strokeColor="#F27F0D"
            strokeOpacity={0.95}
            strokeWeight={6}
            clickable={false}
          />
        )}
        {destinationPath.length >= 2 && (
          <Polyline
            path={destinationPath}
            strokeColor="#3B82F6"
            strokeOpacity={0.9}
            strokeWeight={6}
            clickable={false}
          />
        )}

        {/* Proposed straight-line transfer connection */}
        <Polyline
          path={connectionPath}
          strokeColor="#64748B"
          strokeOpacity={0.9}
          strokeWeight={3}
          clickable={false}
        />

        {/* Managed transfer points */}
        <AdvancedMarker
          position={alightingPosition}
          title={`Alight at ${alightingPoint.name}`}
          zIndex={500}
        >
          <div className="flex items-center gap-1.5 rounded-full border-2 border-background bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>Alight · {alightingPoint.name}</span>
          </div>
        </AdvancedMarker>
        <AdvancedMarker
          position={boardingPosition}
          title={`Board at ${boardingPoint.name}`}
          zIndex={500}
        >
          <div className="flex items-center gap-1.5 rounded-full border-2 border-background bg-info px-3 py-2 text-xs font-semibold text-white shadow-lg">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>Board · {boardingPoint.name}</span>
          </div>
        </AdvancedMarker>

        {/* Map legend and distance disclaimer */}
        <MapControl position={ControlPosition.LEFT_BOTTOM}>
          <div className="m-3 max-w-xs rounded-lg border border-stroke bg-background/95 p-3 shadow-md backdrop-blur-sm">
            <p className="text-xs font-semibold text-text-primary">
              Transfer Review
            </p>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <LegendItem className="bg-primary" label="Source route" />
              <LegendItem className="bg-info" label="Destination route" />
              <LegendItem
                className="bg-slate-500"
                label="Proposed straight-line connection"
              />
            </div>
            <p className="mt-2 border-t border-stroke pt-2 text-[11px] leading-relaxed text-text-secondary">
              The connection line is a review aid, not a walking route or
              safety assessment.
            </p>
          </div>
        </MapControl>
      </Map>
    </div>
  );
}

/**
 * Displays one compact visual key for the transfer map.
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
