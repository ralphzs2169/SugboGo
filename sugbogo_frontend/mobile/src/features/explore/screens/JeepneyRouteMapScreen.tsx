import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import JeepneyRouteMap from "../components/getting-there/JeepneyRouteMap";
import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import RoadRouteLoadingState from "../components/getting-there/RoadRouteLoadingState";
import useDirectJourneyMap from "../hooks/useDirectJourneyMap";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import { formatJourneyDistance } from "../utils/directJourney.utils";

type Props = {
  businessId: number;
  routeVariantId: number;
  boardingTransitPointId: number;
  alightingTransitPointId: number;
};

/**
 * Displays a selected direct jeepney journey on a full-screen map.
 *
 * Keeps route guidance visible through floating journey controls while
 * preserving the map as the primary interactive surface.
 */
export default function JeepneyRouteMapScreen({
  businessId,
  routeVariantId,
  boardingTransitPointId,
  alightingTransitPointId,
}: Props) {
  const insets = useSafeAreaInsets();
  const userLocation = useUserLocation();
  const originBusinessId = useJourneyOriginStore((state) => state.businessId);
  const confirmedOrigin = useJourneyOriginStore(
    (state) => state.confirmedOrigin,
  );
  const businessQuery = useExploreBusinessProfile(businessId);
  const mapQuery = useDirectJourneyMap(
    businessId,
    routeVariantId,
    boardingTransitPointId,
    alightingTransitPointId,
  );

  useQueryErrorNotification({
    error: mapQuery.error,
    toastId: "direct-journey-map-error",
    title: "Unable to load jeepney route",
    fallbackMessage: "We couldn't load this journey map right now.",
  });

  const businessName = businessQuery.business?.business_name ?? "Destination";
  const storedOrigin =
    originBusinessId === businessId ? confirmedOrigin : null;
  const deviceOrigin =
    userLocation.status === "available" &&
    userLocation.latitude !== null &&
    userLocation.longitude !== null
      ? {
          type: "current" as const,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          label: "Current location",
        }
      : null;
  const activeOrigin = storedOrigin ?? deviceOrigin;

  if (!activeOrigin && userLocation.status === "loading") {
    return (
      <View className="flex-1 bg-background px-screen-x pb-5 pt-4">
        <RoadRouteLoadingState message="Finding your current location…" />
      </View>
    );
  }

  if (
    !activeOrigin &&
    (userLocation.status === "denied" ||
      userLocation.status === "unavailable")
  ) {
    return (
      <View className="flex-1 bg-background px-screen-x pb-5 pt-4">
        <LocationUnavailableState
          status={userLocation.status}
          isRetrying={userLocation.isRefreshingLocation}
          onRetry={() => void userLocation.refreshLocation()}
        />
      </View>
    );
  }

  if (mapQuery.error && !mapQuery.journey) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load jeepney route"
          description="We couldn't load this journey map right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void mapQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (mapQuery.isLoading || !mapQuery.journey) {
    return (
      <View className="flex-1 bg-background px-screen-x pb-5 pt-4">
        <RoadRouteLoadingState message="Loading the jeepney route…" />
      </View>
    );
  }

  const journey = mapQuery.journey;

  return (
    <View className="flex-1 bg-background">
      {/* Full-screen journey map */}
      <JeepneyRouteMap
        journey={journey}
        originLocation={activeOrigin!}
        originMarkerLabel={
          activeOrigin!.type === "current"
            ? "Current location"
            : "Starting point"
        }
        originMarkerTitle={activeOrigin!.label}
        businessName={businessName}
      />

      {/* Floating navigation and route identity */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 px-screen-x pt-4"
      >
        <View className=" flex-row items-start gap-3">
          <View className="flex-1 flex-row items-center rounded-2xl border border-border-primary bg-surface px-3 py-2.5 shadow-sm">
            <View className="mr-3 rounded-xl bg-brand px-3.5 py-2">
              <AppText weight="superbold" className="text-lg text-white">
                {journey.jeepney_route_code}
              </AppText>
            </View>

            <View className="flex-1">
              <AppText
                weight="bold"
                className="text-sm text-text-primary"
                numberOfLines={1}
              >
                {journey.route_variant.origin.name} →{" "}
                {journey.route_variant.destination.name}
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                Approx.{" "}
                {formatJourneyDistance(
                  journey.ride.approximate_distance_meters,
                )}{" "}
                ride
              </AppText>
            </View>
          </View>
        </View>
      </View>

      {/* Floating boarding and alighting guidance */}
      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 px-screen-x"
        style={{
          paddingBottom: insets.bottom + 14,
        }}
      >
        <View className="rounded-2xl border border-border-primary bg-surface p-4 shadow-lg">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <View className="flex-row items-center">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-green-50">
                  <MaterialCommunityIcons
                    name="bus-stop"
                    size={18}
                    color="#16A34A"
                  />
                </View>

                <AppText
                  weight="bold"
                  className="ml-2 text-xs text-text-secondary"
                >
                  Board
                </AppText>
              </View>

              <AppText
                weight="semibold"
                className="mt-2 text-sm leading-5 text-text-primary"
                numberOfLines={2}
              >
                {journey.boarding_transit_point.name}
              </AppText>
            </View>

            <View className="w-px bg-border-primary" />

            <View className="flex-1">
              <View className="flex-row items-center">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-soft">
                  <MaterialCommunityIcons
                    name="map-marker-check-outline"
                    size={18}
                    color={theme.extends.colors.brand}
                  />
                </View>

                <AppText
                  weight="bold"
                  className="ml-2 text-xs text-text-secondary"
                >
                  Get off
                </AppText>
              </View>

              <AppText
                weight="semibold"
                className="mt-2 text-sm leading-5 text-text-primary"
                numberOfLines={2}
              >
                {journey.alighting_transit_point.name}
              </AppText>

              {journey.landmark_context && (
                <AppText className="mt-1 text-xs text-brand" numberOfLines={2}>
                  Near {journey.landmark_context.name}
                </AppText>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
