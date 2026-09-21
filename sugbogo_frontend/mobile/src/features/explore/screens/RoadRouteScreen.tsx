import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import RoadRouteLoadingState from "../components/getting-there/JeepMapGuideSkeleton";
import RoadRouteMap from "../components/getting-there/RoadRouteMap";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import useRoadRoute from "../hooks/useRoadRoute";
import { openGoogleMapsDirections } from "../services/googleMapsHandoff.service";
import { formatJourneyDistance } from "../utils/directJourney.utils";
import { formatRoadRouteDuration } from "../utils/roadRoute.utils";

type Props = {
  businessId: number;
};

/** Shows a backend-proxied Google driving route to one approved business. */
export default function RoadRouteScreen({ businessId }: Props) {
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
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
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

  const businessName = businessQuery.business?.business_name ?? "Destination";

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

  return (
    <SafeAreaView
      edges={["bottom"]}
      className="flex-1 bg-background px-screen-x pb-5 pt-4"
    >
      {/* Destination context */}
      <View className="mb-4">
        <AppText className="text-sm text-text-secondary">Road route to</AppText>
        <AppText weight="extrabold" className="mt-1 text-2xl text-text-primary">
          {businessName}
        </AppText>
      </View>

      {/* Location, route, and recovery states */}
      {userLocation.status === "loading" ? (
        <RoadRouteLoadingState message="Finding your current location…" />
      ) : userLocation.status === "denied" ||
        userLocation.status === "unavailable" ? (
        <LocationUnavailableState
          status={userLocation.status}
          purpose="road-route"
          isRetrying={userLocation.isRefreshingLocation}
          onRetry={() => void userLocation.refreshLocation()}
        />
      ) : roadRouteQuery.isLoading && !roadRouteQuery.result ? (
        <RoadRouteLoadingState message="Loading the road route…" />
      ) : roadRouteQuery.error && !roadRouteQuery.result ? (
        <ErrorState
          title="Unable to load road route"
          description="We couldn't load the road route right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void roadRouteQuery.refetch()}
        />
      ) : roadRouteQuery.route ? (
        <View className="flex-1">
          {/* Approximate route summary */}
          <View className="mb-4 flex-row gap-3">
            <View className="flex-1 rounded-card border border-border-primary bg-surface px-4 py-3">
              <AppText className="text-xs text-text-secondary">
                Distance by road
              </AppText>
              <AppText
                weight="extrabold"
                className="mt-1 text-xl text-text-primary"
              >
                {formatJourneyDistance(roadRouteQuery.route.distance_meters)}
              </AppText>
            </View>
            <View className="flex-1 rounded-card border border-border-primary bg-surface px-4 py-3">
              <AppText className="text-xs text-text-secondary">
                Approx. duration
              </AppText>
              <AppText
                weight="extrabold"
                className="mt-1 text-xl text-text-primary"
              >
                {formatRoadRouteDuration(roadRouteQuery.route.duration_seconds)}
              </AppText>
            </View>
          </View>

          {/* Road-following map */}
          <RoadRouteMap
            route={roadRouteQuery.route}
            businessName={businessName}
          />

          <View className="mt-3 flex-row items-start rounded-xl bg-info px-3 py-2.5">
            <MaterialCommunityIcons
              name="information-outline"
              size={17}
              color={theme.extends.colors.text.info}
            />
            <AppText className="ml-2 flex-1 text-xs leading-4 text-text-info">
              Duration is approximate and does not include live traffic.
            </AppText>
          </View>

          {/* External navigation handoff */}
          <Button
            title="Continue in Google Maps"
            onPress={handleContinueInGoogleMaps}
            loading={isHandoffPending}
            disabled={isHandoffPending}
            icon={
              <MaterialCommunityIcons
                name="google-maps"
                size={20}
                color={theme.extends.colors.background}
              />
            }
            className="mt-4"
            accessibilityLabel="Continue road navigation in Google Maps"
          />
        </View>
      ) : roadRouteQuery.result ? (
        <ErrorState
          title="No road route available"
          description="Google couldn't provide a driving route to this business right now."
          primaryActionTitle="Try Again"
          onPrimaryAction={() => void roadRouteQuery.refetch()}
        />
      ) : null}
    </SafeAreaView>
  );
}
