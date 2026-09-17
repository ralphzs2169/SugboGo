import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";

type MapMarkerVariant =
  | "business"
  | "google"
  | "custom"
  | "pending"
  | "explorer"
  | "origin"
  | "boarding"
  | "alighting"
  | "destination";

type Props = {
  variant: MapMarkerVariant;
  imageUrl?: string | null;
  avatarKey?: string | null;
};

type MarkerConfig = {
  color: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

const MARKERS: Record<MapMarkerVariant, MarkerConfig> = {
  business: {
    color: theme.extends.colors.brand,
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
  explorer: {
    color: theme.extends.colors.brand,
  },
  boarding: {
    color: "#3B82F6",
    icon: "bus-stop",
  },

  alighting: {
    color: "#22C55E",
    icon: "exit-run",
  },
  destination: {
    color: theme.extends.colors.brand,
  },

  origin: {
    color: theme.extends.colors.brand,
  },
};

const IDENTITY_MARKER_SIZE = 28;
const IDENTITY_MARKER_BORDER_WIDTH = 2;
const COORDINATE_STAND_HEIGHT = 8;
const COORDINATE_DOT_SIZE = 5;

/**
 * Darkens a hex color while preserving the marker's base hue.
 */
function darkenHexColor(color: string, amount = 0.18) {
  const hex = color.replace("#", "");

  if (hex.length !== 6) {
    return color;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  const darken = (value: number) =>
    Math.max(0, Math.round(value * (1 - amount)))
      .toString(16)
      .padStart(2, "0");

  return `#${darken(red)}${darken(green)}${darken(blue)}`;
}

/**
 * Displays reusable map markers for journey and location points.
 *
 * Uses compact circular identity markers for the Explorer and businesses,
 * while transit and generic locations use the shared teardrop marker style.
 */
export default function MapMarker({ variant, imageUrl, avatarKey }: Props) {
  const marker = MARKERS[variant];
  const borderColor = darkenHexColor(marker.color);

  const isExplorer = variant === "explorer";
  const isBusiness = variant === "business" || variant === "destination";

  const usesCircularIdentity = isExplorer || isBusiness;

  if (usesCircularIdentity) {
    return (
      <View className="items-center">
        {/* Circular location identity */}
        <View
          className="items-center justify-center overflow-hidden rounded-full border-2 border-brand"
          style={{
            width: IDENTITY_MARKER_SIZE + IDENTITY_MARKER_BORDER_WIDTH * 2,
            height: IDENTITY_MARKER_SIZE + IDENTITY_MARKER_BORDER_WIDTH * 2,
            backgroundColor: marker.color,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 4,
            shadowOffset: {
              width: 0,
              height: 2,
            },
            elevation: 5,
          }}
        >
          {isExplorer ? (
            <Avatar
              imageUrl={imageUrl}
              avatarKey={avatarKey}
              size={IDENTITY_MARKER_SIZE}
            />
          ) : imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{
                width: IDENTITY_MARKER_SIZE,
                height: IDENTITY_MARKER_SIZE,
              }}
              contentFit="cover"
            />
          ) : (
            <MaterialCommunityIcons
              name="store-outline"
              size={16}
              color="#FFFFFF"
            />
          )}
        </View>

        {/* Coordinate stand */}
        <View
          style={{
            width: 2,
            height: COORDINATE_STAND_HEIGHT,
            backgroundColor: theme.extends.colors.text.secondary,
          }}
        />

        {/* Exact map coordinate */}
        <View
          style={{
            width: COORDINATE_DOT_SIZE,
            height: COORDINATE_DOT_SIZE,
            borderRadius: COORDINATE_DOT_SIZE / 2,
            backgroundColor: theme.extends.colors.brand,
          }}
        />
      </View>
    );
  }

  return (
    <View className="items-center">
      {/* Floating teardrop marker */}
      <View
        className="relative items-center"
        style={{
          width: 40,
          height: 48,
        }}
      >
        <Svg
          width={40}
          height={48}
          viewBox="0 0 48 58"
          style={{
            position: "absolute",
          }}
        >
          <Path
            d="
              M24 1
              C11.3 1 1 11.3 1 24
              C1 31.8 4.9 37.8 10.9 42.9
              C15.7 47 20 51.8 23.1 56.3
              C23.5 56.9 24.5 56.9 24.9 56.3
              C28 51.8 32.3 47 37.1 42.9
              C43.1 37.8 47 31.8 47 24
              C47 11.3 36.7 1 24 1
              Z
            "
            fill={marker.color}
            stroke={borderColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>

        {/* Marker identity */}
        <View
          pointerEvents="none"
          className="absolute items-center justify-center"
          style={{
            top: 6,
            left: 7,
            width: 26,
            height: 26,
          }}
        >
          {marker.icon ? (
            <MaterialCommunityIcons
              name={marker.icon}
              size={18}
              color="#FFFFFF"
            />
          ) : (
            <View className="h-3 w-3 rounded-full bg-white" />
          )}
        </View>
      </View>

      {/* Exact map coordinate */}
      <View
        style={{
          width: COORDINATE_DOT_SIZE,
          height: COORDINATE_DOT_SIZE,
          marginTop: 4,
          borderRadius: COORDINATE_DOT_SIZE / 2,
          backgroundColor: marker.color,
          borderWidth: 0.75,
          borderColor,
        }}
      />
    </View>
  );
}
