import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LocationObject } from "expo-location";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import BusinessDiscoveryMap, {
  type BusinessMapMarker,
} from "@/features/map/components/BusinessDiscoveryMap";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";

import ExploreSectionHeader from "../ExploreSectionHeader";
import ExploreMapSkeleton from "./ExploreMapSkeleton";

type Props = {
  businesses: BusinessMapMarker[];
  isLoading: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  userLocation: LocationObject | null;
  onOpenMap: () => void;
};

const MAP_PREVIEW_HEIGHT = 210;

/**
 * Displays a read-only preview of business discovery on the Cebu map.
 *
 * Handles map-preview loading and recovery locally while keeping successful
 * previews navigable to the full interactive map.
 */
export default function ExploreMapSection({
  businesses,
  isLoading,
  isRefetching,
  error,
  refetch,
  userLocation,
  onOpenMap,
}: Props) {
  return (
    <View className="py-6">
      {/* Section heading */}
      <ExploreSectionHeader
        title="Explore Cebu on the Map"
        subtitle="See places around you and discover what's nearby."
      />

      {/* Map loading state */}
      {isLoading ? (
        <ExploreMapSkeleton />
      ) : error ? (
        /* Section recovery */
        <ErrorState
          title="Unable to load the map"
          description="We couldn't load nearby places right now."
          icon="map-marker-off-outline"
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
          isRetrying={isRefetching}
          size="section"
        />
      ) : (
        /* Map discovery preview */
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

              {/* Map context */}
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

            {/* Full-map navigation */}
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <View className="min-w-0 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
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
      )}
    </View>
  );
}
