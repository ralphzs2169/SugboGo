import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";

import { theme } from "@/constants/theme";

type MapMarkerVariant =
  | "business"
  | "google"
  | "custom"
  | "pending"
  | "boarding"
  | "alighting"
  | "destination";

type Props = {
  variant: MapMarkerVariant;
};

const MARKERS = {
  business: {
    color: theme.extends.colors.brand,
    icon: "storefront-outline",
  },
  google: {
    color: "#4285F4",
    icon: "map-marker-outline",
  },
  custom: {
    color: "#16A34A",
    icon: "star-outline",
  },
  pending: {
    color: "#EF4444",
    icon: "plus",
  },
  boarding: {
    color: "#16A34A",
    icon: "bus-stop",
  },
  alighting: {
    color: theme.extends.colors.brand,
    icon: "map-marker-check-outline",
  },
  destination: {
    color: theme.extends.colors.brand,
    icon: "flag-checkered",
  },
} as const;

/**
 * Displays a reusable pin-style marker for map locations and journey points.
 *
 * Supports general map locations alongside boarding, alighting, and final
 * destination markers used by journey guidance.
 */
export default function MapMarker({ variant }: Props) {
  const marker = MARKERS[variant];

  return (
    <View className="items-center">
      {/* Marker shadow */}
      <View
        className="absolute bottom-0 h-2 w-2 rounded-full bg-black/25"
        style={{
          transform: [{ scaleX: 2.2 }],
        }}
      />

      {/* Marker body */}
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{
          backgroundColor: marker.color,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 5,
          shadowOffset: {
            width: 0,
            height: 3,
          },
          elevation: 6,
        }}
      >
        <MaterialCommunityIcons name={marker.icon} size={18} color="#FFFFFF" />
      </View>

      {/* Marker pointer */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 12,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: marker.color,
          marginTop: -2,
        }}
      />
    </View>
  );
}
