import { router } from "expo-router";
import { View } from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import JeepneyRouteContextCard from "../components/getting-there/jeepney-guidance/jeep-guide-map/JeepneyRouteContextCard";
import JeepneyStopGuidanceCard from "../components/getting-there/jeepney-guidance/jeep-guide-map/JeepneyStopGuidanceCard";
import JeepneyRouteMap from "../components/getting-there/JeepneyRouteMap";
import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import JeepMapGuideSkeleton from "../components/getting-there/JeepMapGuideSkeleton";
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
 * Displays a selected direct Jeepney journey on an edge-to-edge map.
 *
 * Keeps navigation and journey guidance inside safe-area-aware floating
 * controls while allowing the map itself to extend behind the status bar.
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
  const businessCoverPhotoUrl = businessQuery.business?.cover_photo_url ?? null;

  const storedOrigin = originBusinessId === businessId ? confirmedOrigin : null;

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
    return <JeepMapGuideSkeleton message="Finding your current location…" />;
  }

  if (
    !activeOrigin &&
    (userLocation.status === "denied" || userLocation.status === "unavailable")
  ) {
    return (
      <View className="flex-1 bg-background px-screen-x pb-5 pt-4">
        {/* Location unavailable */}
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
      <SafeAreaView className="flex-1 bg-background">
        {/* Journey-map error */}
        <ErrorState
          title="Unable to load jeepney route"
          description="We couldn't load this journey map right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void mapQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (mapQuery.isLoading || !mapQuery.journey) {
    return <JeepMapGuideSkeleton message="Finding your current location…" />;
  }

  const journey = mapQuery.journey;

  const boardingDistanceMeters =
    calculateDistanceInKm(
      activeOrigin!.latitude,
      activeOrigin!.longitude,
      journey.boarding_transit_point.latitude,
      journey.boarding_transit_point.longitude,
    ) * 1000;

  const destinationDistanceMeters =
    calculateDistanceInKm(
      journey.alighting_transit_point.latitude,
      journey.alighting_transit_point.longitude,
      journey.business_location.latitude,
      journey.business_location.longitude,
    ) * 1000;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      {/* Map area */}
      <View className="flex-1">
        {/* Edge-to-edge journey map */}
        <JeepneyRouteMap
          journey={journey}
          originLocation={activeOrigin!}
          originMarkerLabel="Starting point"
          originMarkerTitle={activeOrigin!.label}
          businessName={businessName}
          businessCoverPhotoUrl={businessCoverPhotoUrl}
        />

        {/* Floating route and destination context */}
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-screen-x"
          style={{
            top: insets.top + 12,
          }}
        >
          <JeepneyRouteContextCard
            journey={journey}
            businessName={businessName}
            businessCoverPhotoUrl={businessCoverPhotoUrl}
            onBack={() => router.back()}
          />
        </View>
      </View>

      {/* Persistent journey guidance footer */}
      <JeepneyStopGuidanceCard
        boardingPointName={journey.boarding_transit_point.name}
        boardingDistance={formatJourneyDistance(boardingDistanceMeters)}
        alightingPointName={journey.alighting_transit_point.name}
        destinationDistance={formatJourneyDistance(destinationDistanceMeters)}
        landmarkName={journey.landmark_context?.name}
      />
    </SafeAreaView>
  );
}
