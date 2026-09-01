import { MapPin, Star, Store } from "lucide-react";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

/**
 * Renders the custom marker used by business and landmark maps.
 *
 * Business markers can display their assigned cluster icon, while
 * landmark markers retain their dedicated visual variants.
 */
export default function BusinessMapMarker({ variant = "custom", clusterIcon }) {
  const cluster = CLUSTER_ICONS.find((item) => item.value === clusterIcon);

  const markerConfig = {
    business: {
      color: "#F27F0D",
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

  return (
    <div
      className="relative flex cursor-pointer flex-col items-center"
      aria-label={config.label}
    >
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
