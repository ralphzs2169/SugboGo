import { MapPin } from "lucide-react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";

import GoogleMapsProvider from "@/features/admin-panel/providers/GoogleMapsProvider";
import BusinessMapMarker from "../../../business-applications/components/review/business-location/BusinessMapMarker";

/**
 * Displays a compact, non-interactive preview of the business location.
 *
 * The preview is intentionally simplified for use inside the business
 * hero and opens the full location experience when selected.
 */
export default function BusinessLocationPreview({ location, onClick }) {
  if (location?.latitude == null || location?.longitude == null) {
    return null;
  }

  const position = {
    lat: Number(location.latitude),
    lng: Number(location.longitude),
  };

  const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-end gap-3 text-left"
    >
      {/* Map preview */}
      <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-stroke bg-surface-muted">
        <div className="pointer-events-none h-full w-full">
          <GoogleMapsProvider>
            <Map
              defaultCenter={position}
              defaultZoom={16}
              mapId={GOOGLE_MAP_ID}
              disableDefaultUI
              gestureHandling="none"
            >
              <AdvancedMarker position={position}>
                <BusinessMapMarker variant="business" />
              </AdvancedMarker>
            </Map>
          </GoogleMapsProvider>
        </div>

        {/* Preview overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
          <span className="rounded-full bg-background/95 px-2.5 py-1.5 text-xs font-semibold text-text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            View map
          </span>
        </div>
      </div>

      {/* Location summary */}
      <div className="min-w-0 pb-1">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} strokeWidth={1.8} className="text-text-secondary" />

          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Location
          </p>
        </div>

        <p className="mt-1 text-sm font-medium text-text-primary">
          {location.address || "No address"}
        </p>

        <p className="mt-1 text-xs text-text-secondary">
          {location.city}, {location.province}
        </p>
      </div>
    </button>
  );
}
