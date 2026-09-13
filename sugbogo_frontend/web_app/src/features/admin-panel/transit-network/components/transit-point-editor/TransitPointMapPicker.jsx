import {
  AdvancedMarker,
  ControlPosition,
  Map,
  MapControl,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

const CEBU_CITY_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

/**
 * Provides visual Transit Point placement with a draggable, synchronized marker.
 */
export default function TransitPointMapPicker({ position, onPositionChange }) {
  function handleMapClick(event) {
    if (event.detail.latLng) {
      onPositionChange(event.detail.latLng);
    }
  }

  function handleMarkerDragEnd(event) {
    const nextPosition = event.latLng?.toJSON();

    if (nextPosition) {
      onPositionChange(nextPosition);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-strong bg-surface">
      {/* Location map */}
      <div className="h-80 min-h-72">
        <Map
          defaultCenter={position ?? CEBU_CITY_CENTER}
          defaultZoom={position ? 17 : 13}
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl
          gestureHandling="greedy"
          onClick={handleMapClick}
        >
          {/* Selected Transit Point */}
          {position && (
            <AdvancedMarker
              position={position}
              title="Selected Transit Point location"
              draggable
              onDragEnd={handleMarkerDragEnd}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-lg">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
            </AdvancedMarker>
          )}

          {/* Placement guidance */}
          <MapControl position={ControlPosition.TOP_LEFT}>
            <div className="m-3 max-w-64 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
              <p className="text-xs font-semibold text-text-primary">
                {position ? "Location selected" : "Choose a location"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Click the map to place the marker, or drag it for adjustment.
              </p>
            </div>
          </MapControl>
        </Map>
      </div>
    </div>
  );
}
