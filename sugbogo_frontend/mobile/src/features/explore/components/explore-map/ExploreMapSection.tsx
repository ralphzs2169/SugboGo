import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LocationObject } from "expo-location";
import { Platform, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import AppText from "@/shared/components/AppText";
import MapMarker from "@/shared/components/MapMarker";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  userLocation: LocationObject | null;
  onOpenMap: () => void;
};

type MockBusinessMarker = {
  id: number;
  latitude: number;
  longitude: number;
};

const MAP_PREVIEW_HEIGHT = 210;

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MOCK_BUSINESS_MARKERS: MockBusinessMarker[] = [
  {
    id: 1,
    latitude: 10.319,
    longitude: 123.891,
  },
  {
    id: 2,
    latitude: 10.309,
    longitude: 123.884,
  },
  {
    id: 3,
    latitude: 10.326,
    longitude: 123.879,
  },
  {
    id: 4,
    latitude: 10.312,
    longitude: 123.899,
  },
];

/**
 * Displays a read-only preview of business discovery on the Cebu map.
 *
 * The preview centers on the explorer when location is available and keeps map
 * interaction disabled so it does not compete with the Explore page scroll.
 */
export default function ExploreMapSection({ userLocation, onOpenMap }: Props) {
  const initialRegion = userLocation
    ? {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : DEFAULT_REGION;

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
            <MapView
              provider={PROVIDER_GOOGLE}
              customMapStyle={MAP_STYLE}
              pointerEvents="none"
              initialRegion={initialRegion}
              style={{
                width: "100%",
                height: "100%",
              }}
              showsUserLocation={userLocation !== null}
              showsMyLocationButton={false}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              {...(Platform.OS === "android" && {
                mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
              })}
            >
              {MOCK_BUSINESS_MARKERS.map((business) => (
                <Marker
                  key={business.id}
                  coordinate={{
                    latitude: business.latitude,
                    longitude: business.longitude,
                  }}
                  tracksViewChanges={false}
                >
                  <View collapsable={false}>
                    <MapMarker variant="business" />
                  </View>
                </Marker>
              ))}
            </MapView>

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
