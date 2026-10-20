import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type Ref } from "react";
import { View } from "react-native";
import { Marker, type MapMarker } from "react-native-maps";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { GEM_ACCENT, GEM_FILL, GEM_ICON } from "@/shared/styles/hiddenGems";

/**
 * Shape of the object react-native-map-clustering passes to `renderCluster`.
 */
type Props = {
  id: number | string;
  geometry: { coordinates: [number, number] };
  properties: { point_count: number };
  onPress: () => void;
  /** How many businesses in this cluster are hidden gems (0 when unknown). */
  gemCount?: number;
  markerRef?: Ref<MapMarker>;
};

const BADGE_SIZE = 18;

// Fixed bounding box for every cluster so the native bitmap never resizes.
const BOX_SIZE = 84;
const HALO_PADDING = 8;

/**
 * Picks the core diameter from the number of businesses in the cluster so
 * denser clusters read as heavier without becoming huge.
 */
function getCoreSize(count: number) {
  if (count >= 100) return 58;
  if (count >= 30) return 52;
  if (count >= 10) return 46;
  return 40;
}

function formatCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

/**
 * Displays a cluster of nearby businesses on the discovery map.
 *
 * Brand-colored core with a soft halo, sized by density.
 * Tapping zooms into the cluster through the library's own `onPress`.
 */
export default function MapClusterMarker({
  geometry,
  properties,
  onPress,
  gemCount = 0,
  markerRef,
}: Props) {
  const count = properties.point_count;
  const coreSize = getCoreSize(count);

  // none: brand cluster · mixed: brand + violet gem badge · all: violet cluster
  const hasGems = gemCount > 0;
  const isAllGems = hasGems && gemCount >= count;
  const tone = isAllGems ? GEM_FILL : theme.extends.colors.brand;

  const label = isAllGems
    ? `${count} hidden gems. Double tap to zoom in.`
    : hasGems
      ? `${count} businesses, including ${gemCount} hidden ${
          gemCount === 1 ? "gem" : "gems"
        }. Double tap to zoom in.`
      : `${count} businesses. Double tap to zoom in.`;

  // Android needs one tracked render to capture the bitmap, then stops.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const [longitude, latitude] = geometry.coordinates;

  return (
    <Marker
      ref={markerRef}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      zIndex={2}
      accessibilityLabel={label}
    >
      <View
        collapsable={false}
        onLayout={() => setTracksViewChanges(false)}
        style={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Outer halo */}
        <View
          style={{
            position: "absolute",
            width: coreSize + HALO_PADDING * 2,
            height: coreSize + HALO_PADDING * 2,
            borderRadius: (coreSize + HALO_PADDING * 2) / 2,
            backgroundColor: tone,
            opacity: 0.2,
          }}
        />

        {/* Core */}
        <View
          style={{
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: tone,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <AppText
            weight="bold"
            className={`text-white ${count >= 100 ? "text-xs" : "text-sm"}`}
            style={{ includeFontPadding: false }}
          >
            {formatCount(count)}
          </AppText>
        </View>

        {/* Gem badge: solid violet when mixed, white with violet icon when all gems */}
        {hasGems && (
          <View
            style={{
              position: "absolute",
              top: (BOX_SIZE - coreSize) / 2 - 6,
              right: (BOX_SIZE - coreSize) / 2 - 6,
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isAllGems ? "#FFFFFF" : GEM_FILL,
              elevation: 8,
              zIndex: 2,
            }}
          >
            <MaterialCommunityIcons
              name="diamond-stone"
              size={10}
              color={isAllGems ? GEM_ACCENT : GEM_ICON}
            />
          </View>
        )}
      </View>
    </Marker>
  );
}
