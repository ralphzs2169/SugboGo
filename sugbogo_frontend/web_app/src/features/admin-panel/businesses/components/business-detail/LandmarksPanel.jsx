import { ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";

/**
 * Displays the business landmarks associated with a registered location.
 *
 * The panel can be collapsed to keep the map unobstructed while retaining
 * quick access to landmark details and map focus behavior.
 */
export default function LandmarksPanel({
  landmarks = [],
  selectedLandmarkId,
  onLandmarkSelect,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="absolute right-4 top-4 w-[300px] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-stroke bg-background/95 shadow-lg">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface"
        aria-expanded={isExpanded}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">
            Business Landmarks
          </h3>

          {!isExpanded && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {landmarks.length
                ? `${landmarks.length} registered landmark${
                    landmarks.length === 1 ? "" : "s"
                  }`
                : "No landmarks registered"}
            </p>
          )}
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 text-text-secondary transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Landmark details */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-stroke">
            {landmarks.length ? (
              <div className="max-h-[300px] divide-y divide-stroke overflow-y-auto">
                {landmarks.map((landmark) => {
                  const isSelected = selectedLandmarkId === landmark.id;

                  return (
                    <button
                      key={landmark.id}
                      type="button"
                      onClick={() => onLandmarkSelect(landmark)}
                      className={`flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-interaction-hover"
                          : "hover:bg-interaction-hover"
                      }`}
                    >
                      <MapPin
                        size={17}
                        strokeWidth={1.8}
                        className={`mt-0.5 shrink-0 ${
                          isSelected ? "text-primary" : "text-text-secondary"
                        }`}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {landmark.name}
                        </p>

                        {landmark.source === "custom" && (
                          <p className="mt-1 text-xs text-text-secondary">
                            Custom Landmark
                          </p>
                        )}

                        {landmark.source === "google" && (
                          <p className="mt-1 truncate text-xs text-text-secondary">
                            {landmark.address || "No address provided"}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <MapPin
                  size={20}
                  strokeWidth={1.8}
                  className="mx-auto text-text-secondary"
                />

                <p className="mt-2 text-sm font-medium text-text-primary">
                  No nearby landmarks
                </p>

                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  No nearby landmarks are registered for this business.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
