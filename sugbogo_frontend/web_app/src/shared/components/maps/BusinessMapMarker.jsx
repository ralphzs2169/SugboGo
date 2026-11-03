import { MapPin, Star, Store } from "lucide-react";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

/**
 * Renders the custom marker used by business and landmark maps.
 *
 * Business markers can display their assigned cluster icon, while
 * landmark markers retain their dedicated visual variants.
 */
export default function BusinessMapMarker({
  variant = "custom",
  clusterIcon,
  suspended = false,
  selected = false,
}) {
  const cluster = CLUSTER_ICONS.find((item) => item.value === clusterIcon);

  const markerConfig = {
    business: {
      color: suspended ? "#B7791F" : "#F27F0D",
      icon: cluster?.icon ?? Store,
      label: "Business location",
    },
    google: {
      color: "#4285F4",
      icon: MapPin,
      label: "Google landmark",
    },
    custom: {
      color: "#16A34A",
      icon: Star,
      label: "Custom landmark",
    },
  };

  const config = markerConfig[variant] ?? markerConfig.custom;
  const Icon = config.icon;

  if (variant === "business") {
    return (
      <div className="flex cursor-pointer flex-col items-center">
        {/* Fixed identity box keeps the coordinate anchor stable on selection. */}
        <div className="relative flex h-12 w-12 items-center justify-center">
          {selected && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/25" />
              <div className="absolute h-[42px] w-[42px] rounded-full border-2 border-primary" />
            </>
          )}
          <div
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white ${selected ? "scale-110" : ""}`}
            style={{
              backgroundColor: config.color,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.22)",
            }}
          >
            <Icon size={16} strokeWidth={2} className="text-white" />
          </div>
          {suspended && (
            <span
              className="absolute right-0 top-0 z-20 rounded-full border border-white bg-amber-100 px-1 text-xs font-bold text-amber-900"
              aria-hidden="true"
            >
              Ⅱ
            </span>
          )}
        </div>
        {/* Stem and dot identify the exact coordinate, matching Mobile. */}
        <div className="-mt-2 h-2 w-0.5 bg-text-secondary" />
        <div
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: config.color }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex cursor-pointer flex-col items-center ${selected ? "scale-110 drop-shadow-lg ring-2 ring-primary rounded-full" : ""}`}
      aria-label={config.label}
    >
      {suspended && (
        <span
          className="absolute -right-1 -top-2 z-20 rounded-full border border-white bg-amber-100 px-1 text-xs font-bold text-amber-900"
          aria-hidden="true"
        >
          Ⅱ
        </span>
      )}
      {/* Marker shadow */}
      <div
        className="absolute bottom-0 h-2 w-2 rounded-full bg-black/25"
        style={{
          transform: "scaleX(2.2)",
        }}
      />

      {/* Marker circle */}
      <div
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white"
        style={{
          backgroundColor: config.color,
          boxShadow: "0 3px 10px rgba(0, 0, 0, 0.28)",
        }}
      >
        <Icon size={18} strokeWidth={2} className="text-white" />
      </div>

      {/* Marker pointer */}
      <div
        className="relative z-10 -mt-0.5 h-0 w-0"
        style={{
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `12px solid ${config.color}`,
        }}
      />
    </div>
  );
}
