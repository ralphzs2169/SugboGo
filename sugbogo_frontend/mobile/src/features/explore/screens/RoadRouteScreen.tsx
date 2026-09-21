import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import RoadRouteContextCard from "../components/getting-there/road-route/RoadRouteContextCard";
import RoadRouteMap from "../components/getting-there/RoadRouteMap";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import useRoadRoute from "../hooks/useRoadRoute";
import { openGoogleMapsDirections } from "../services/googleMapsHandoff.service";

import RoadRouteGuidanceCard from "../components/getting-there/road-route/RoadRouteGuidanceCard";
import RoadRouteMapSkeleton from "../components/getting-there/road-route/RoadRouteMapSkeleton";

type Props = {
  businessId: number;
};

/**
 * Displays a map-first driving-route preview to an approved business.
 *
 * Keeps the road map visually primary while presenting destination identity,
 * approximate route metrics, and the Google Maps navigation handoff in
 * persistent map-aligned surfaces.
 */
export default function RoadRouteScreen({ businessId }: Props) {
  const insets = useSafeAreaInsets();

  const handoffPendingRef = useRef(false);
  const [isHandoffPending, setIsHandoffPending] = useState(false);

  const businessQuery = useExploreBusinessProfile(businessId);
  const userLocation = useUserLocation();

  const hasUsableLocation = userLocation.status === "available";

  const latitude = hasUsableLocation ? userLocation.latitude : null;
  const longitude = hasUsableLocation ? userLocation.longitude : null;

  const roadRouteQuery = useRoadRoute(businessId, latitude, longitude);

  useQueryErrorNotification({
    error: businessQuery.error,
    toastId: "road-route-business-error",
    title: "Unable to load destination",
    fallbackMessage: "We couldn't load this business right now.",
  });

  useQueryErrorNotification({
    error: roadRouteQuery.error,
    toastId: "road-route-error",
    title: "Unable to load road route",
    fallbackMessage: "We couldn't load the road route right now.",
  });

  if (businessQuery.error && !businessQuery.business) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Destination loading error */}
        <ErrorState
          title="Unable to load destination"
          description="We couldn't load this business right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void businessQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const business = businessQuery.business;

  const businessName = business?.business_name ?? "Destination";
  const businessCoverPhotoUrl = business?.cover_photo_url ?? null;

  async function handleContinueInGoogleMaps() {
    const destination = roadRouteQuery.route?.destination;

    if (!destination || handoffPendingRef.current) {
      return;
    }

    handoffPendingRef.current = true;
    setIsHandoffPending(true);

    try {
      const result = await openGoogleMapsDirections(destination);

      if (result === "unavailable") {
        Toast.show({
          type: "error",
          text1: "Google Maps isn't available on this device.",
        });

        return;
      }

      if (result === "failed") {
        Toast.show({
          type: "error",
          text1: "Unable to open Google Maps.",
          text2: "Please try again.",
        });
      }
    } finally {
      handoffPendingRef.current = false;
      setIsHandoffPending(false);
    }
  }

  if (userLocation.status === "loading") {
    return <RoadRouteMapSkeleton message="Finding your current location…" />;
  }

  if (
    userLocation.status === "denied" ||
    userLocation.status === "unavailable"
  ) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Location recovery */}
        <LocationUnavailableState
          status={userLocation.status}
          purpose="road-route"
          isRetrying={userLocation.isRefreshingLocation}
          onRetry={() => void userLocation.refreshLocation()}
        />
      </SafeAreaView>
    );
  }

  if (roadRouteQuery.isLoading && !roadRouteQuery.result) {
    return <RoadRouteMapSkeleton message="Loading the road route…" />;
  }

  if (roadRouteQuery.error && !roadRouteQuery.result) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Route loading error */}
        <ErrorState
          title="Unable to load road route"
          description="We couldn't load the road route right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void roadRouteQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (!roadRouteQuery.route) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Unavailable route */}
        <ErrorState
          title="No road route available"
          description="Google couldn't provide a driving route to this business right now."
          primaryActionTitle="Try Again"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void roadRouteQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const route = roadRouteQuery.route;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      {/* Full-screen road route map */}
      <View className="flex-1">
        <RoadRouteMap
          route={route}
          businessName={businessName}
          businessCoverPhotoUrl={businessCoverPhotoUrl}
        />

        {/* Floating destination context */}
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-screen-x"
          style={{
            top: insets.top + 12,
          }}
        >
          <RoadRouteContextCard
            businessName={businessName}
            businessCoverPhotoUrl={businessCoverPhotoUrl}
            onBack={() => router.back()}
          />
        </View>
      </View>

      {/* Persistent route guidance */}
      <RoadRouteGuidanceCard
        distanceMeters={route.distance_meters}
        durationSeconds={route.duration_seconds}
        isHandoffPending={isHandoffPending}
        onContinueInGoogleMaps={() => void handleContinueInGoogleMaps()}
      />
    </SafeAreaView>
  );
}
