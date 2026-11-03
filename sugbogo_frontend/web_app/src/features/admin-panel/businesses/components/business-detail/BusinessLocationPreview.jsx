import { ArrowRight, MapPin } from "lucide-react";

/** Display a complete address and open the existing interactive map without static-image requests. */
export default function BusinessLocationPreview({ location, onClick }) {
  const hasCoordinates =
    location?.latitude != null &&
    location?.longitude != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));
  const context = [location?.city, location?.province]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="min-w-0 space-y-3">
      {/* Address and map navigation */}
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <MapPin size={14} aria-hidden="true" /> Location
        </h2>
        <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm font-medium text-text-primary">
          {location?.address || "Address unavailable"}
        </p>
        {context && (
          <p className="mt-1 text-xs text-text-secondary">{context}</p>
        )}
        {!hasCoordinates && (
          <p className="mt-1 text-xs text-text-secondary">
            Map location unavailable
          </p>
        )}
      </div>
      {hasCoordinates && (
        <button
          type="button"
          aria-label="View map"
          onClick={onClick}
          className="inline-flex cursor-pointer items-center rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        >
          <span className="inline-flex items-center gap-2">
            View map
            <ArrowRight
              size={15}
              strokeWidth={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
          </span>
        </button>
      )}
    </div>
  );
}
