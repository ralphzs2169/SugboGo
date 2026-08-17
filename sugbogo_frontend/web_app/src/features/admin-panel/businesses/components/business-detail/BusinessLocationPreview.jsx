import { MapPin } from "lucide-react";

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 96;
const PREVIEW_ZOOM = 15;

const MARKER_COLOR = "0xF27F0D";

function buildStaticMapUrl(position) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const params = new URLSearchParams({
    center: `${position.lat},${position.lng}`,
    zoom: String(PREVIEW_ZOOM),
    size: `${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`,
    scale: "2",
    markers: `color:${MARKER_COLOR}|${position.lat},${position.lng}`,
    key: apiKey,
  });

  const suppressedStyles = [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:road|element:labels.icon|visibility:off",
  ];

  suppressedStyles.forEach((style) => params.append("style", style));

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Displays a compact business location summary with a static map preview.
 *
 * The map preview is intentionally non-interactive and opens the full
 * location experience when selected.
 */
export default function BusinessLocationPreview({ location, onClick }) {
  if (location?.latitude == null || location?.longitude == null) {
    return null;
  }

  const position = {
    lat: Number(location.latitude),
    lng: Number(location.longitude),
  };

  const staticMapUrl = buildStaticMapUrl(position);

  console.log(staticMapUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-start gap-4 text-left"
    >
      {/* Location summary */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} strokeWidth={1.8} className="text-text-secondary" />

          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Location
          </p>
        </div>

        <p className="mt-1 truncate text-sm font-medium text-text-primary">
          {location.address || "No address"}
        </p>

        <p className="mt-1 text-xs text-text-secondary">
          {location.city}, {location.province}
        </p>
      </div>

      {/* Map preview */}
      <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-stroke bg-surface-muted">
        <img
          src={staticMapUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          loading="lazy"
        />

        {/* Preview overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
          <span className="rounded-full bg-background/95 px-2.5 py-1.5 text-xs font-semibold text-text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            View map
          </span>
        </div>
      </div>
    </button>
  );
}
