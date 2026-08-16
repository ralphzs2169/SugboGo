import { ChevronDown, MapPinned } from "lucide-react";
import { useState } from "react";

import BusinessManagementMap from "./BusinessManagementMap";
import GoogleMapsProvider from "../../../providers/GoogleMapsProvider";

/**
 * Displays the geographic distribution of managed businesses.
 *
 * The map is expanded by default and can be collapsed to keep the
 * business management table easier to reach when geographic context
 * is not needed.
 */
export default function BusinessLocationsSection({
  businesses,
  isLoading,
  error,
  onRetry,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Map section header */}
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interaction-hover sm:px-5 shadow-sm"
        aria-expanded={isExpanded}
      >
        <div className="shrink-0 rounded-lg bg-surface-muted p-2 text-text-secondary">
          <MapPinned size={18} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">
            Business Locations
          </h3>

          {!isExpanded && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {isLoading
                ? "Loading businesses..."
                : `${businesses.length} businesses shown`}
            </p>
          )}
        </div>

        {isExpanded && (
          <span className="text-xs text-text-secondary">
            {isLoading
              ? "Loading businesses..."
              : `${businesses.length} businesses shown`}
          </span>
        )}

        <ChevronDown
          size={18}
          className={`shrink-0 text-text-secondary transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Map */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-stroke">
            <GoogleMapsProvider>
              {/* <BusinessManagementMap
                businesses={businesses}
                isLoading={isLoading}
                error={error}
                onRetry={onRetry}
                className="h-[420px] rounded-none border-0"
              /> */}
            </GoogleMapsProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
