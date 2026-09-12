import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LocationObject } from "expo-location";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import BusinessDiscoveryMap, {
  type BusinessMapMarker,
} from "@/features/map/components/BusinessDiscoveryMap";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  businesses: BusinessMapMarker[];
  userLocation: LocationObject | null;
  onOpenMap: () => void;
};

const MAP_PREVIEW_HEIGHT = 210;

/**
 * Displays a read-only preview of nearby business discovery on the Cebu map.
 *
 * The section receives nearby businesses from the Explore screen and delegates
 * marker rendering, clustering, and user-location positioning to the shared
 * discovery map while keeping the preview tappable for full map navigation.
 */
export default function ExploreMapSection({
  businesses,
  userLocation,
  onOpenMap,
}: Props) {
  return (
    <View className="py-6">
      {/* Section introduction */}
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Explore Cebu on the Map
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          See places around you and discover what&apos;s nearby.
        </AppText>
      </View>

      {/* Map discovery preview */}
      <View className="mx-4 overflow-hidden rounded-card border border-border-primary bg-surface">
        <SafePressable
          onPress={onOpenMap}
          accessibilityRole="button"
          accessibilityLabel="Open Cebu discovery map"
          className="cursor-pointer active:opacity-95"
        >
          <View
            style={{ height: MAP_PREVIEW_HEIGHT }}
            className="overflow-hidden bg-surface-secondary"
          >
            <BusinessDiscoveryMap
              businesses={businesses}
              userLocation={userLocation}
              interactive={false}
              trackMarkerUpdates
            />

            {/* Map context label */}
            <View className="absolute left-3 top-3 flex-row items-center rounded-full bg-white/95 px-3 py-2">
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={15}
                color={theme.extends.colors.brand}
              />

              <AppText
                weight="semibold"
                className="ml-1.5 text-xs text-text-primary"
              >
                Cebu City
              </AppText>
            </View>
          </View>

          {/* Map action */}
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="min-w-0 flex-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Discover places near you
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                Browse businesses by location on the full map.
              </AppText>
            </View>

            <View className="ml-3 flex-row items-center">
              <AppText weight="semibold" className="text-sm text-brand">
                Open Map
              </AppText>

              <MaterialCommunityIcons
                name="chevron-right"
                size={19}
                color={theme.extends.colors.brand}
              />
            </View>
          </View>
        </SafePressable>
      </View>
    </View>
  );
}
