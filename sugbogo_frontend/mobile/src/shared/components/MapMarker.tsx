import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";

import { theme } from "@/constants/theme";

type MapMarkerVariant = "business" | "google" | "custom" | "pending";

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
} as const;

export default function MapMarker({ variant }: Props) {
  const marker = MARKERS[variant];

  return (
    <View className="items-center">
      {/* Shadow */}
      <View
        className="absolute bottom-0 h-2 w-2 rounded-full bg-black/25"
        style={{
          transform: [{ scaleX: 2.2 }],
        }}
      />

      {/* Circle */}
      <View
        className="h-10 w-10 items-center justify-center rounded-full border-2 border-white"
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
        <MaterialCommunityIcons name={marker.icon} size={18} color="white" />
      </View>

      {/* Pointer */}
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
