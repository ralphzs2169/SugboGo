import { MapPin, Star, Store } from "lucide-react";

/**
 * Renders the custom marker used by the business review map.
 *
 * Uses the same visual variants as the mobile map marker so business
 * locations, Google landmarks, and custom landmarks remain visually
 * consistent across the SugboGo experience.
 */
export default function BusinessMapMarker({ variant = "custom" }) {
  const markerConfig = {
    business: {
      color: "#F27F0D",
      icon: Store,
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
