import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import DirectJourneyList from "../components/getting-there/jeepney-guidance/DirectJourneyList";
import JeepneyDestinationHeader from "../components/getting-there/jeepney-guidance/JeepneyDestinationHeader";
import JeepneyDestinationStickyHeader from "../components/getting-there/jeepney-guidance/JeepneyDestinationStickyHeader";
import JourneyOriginSelector from "../components/getting-there/jeepney-guidance/JourneyOriginSelector";
import GettingThereEmptyState from "../components/getting-there/GettingThereEmptyState";
import GettingThereLoadingState from "../components/getting-there/GettingThereLoadingState";
import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import useDirectJourneys from "../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import type { DirectJourney } from "../types/directJourney.types";
import { getBusinessAddressDisplay } from "../utils/businessLocation.utils";

type Props = {
  businessId: number;
};

type OriginState = "current" | "selected" | "loading" | "unavailable";

const ORIGIN_DOCK_CONTENT_SPACING = 112;

// Calibrated against JeepneyDestinationHeader's top padding, label, and gap.
// At roughly this position, the destination card reaches the top edge.
const DESTINATION_STICKY_THRESHOLD = 44;

/**
 * Displays direct Jeepney guidance from the Explorer's confirmed starting point.
 *
 * Coordinates destination context, origin selection, location acquisition,
 * route results, map navigation, a persistent floating origin control, and an
 * animated full-width destination header as the initial card scrolls away.
 */
export default function JeepneyGuideScreen({ businessId }: Props) {
  const insets = useSafeAreaInsets();

  const businessQuery = useExploreBusinessProfile(businessId);
  const userLocation = useUserLocation();

  const originBusinessId = useJourneyOriginStore((state) => state.businessId);
  const confirmedOrigin = useJourneyOriginStore(
    (state) => state.confirmedOrigin,
  );
  const confirmOrigin = useJourneyOriginStore((state) => state.confirmOrigin);

  const [stickyHeaderOpacity] = useState(() => new Animated.Value(0));
  const [stickyHeaderTranslateY] = useState(() => new Animated.Value(-20));

  const wasPastStickyThreshold = useRef(false);

  const storedOrigin = originBusinessId === businessId ? confirmedOrigin : null;

  const deviceOrigin = useMemo(() => {
    if (
      userLocation.status !== "available" ||
      userLocation.latitude === null ||
      userLocation.longitude === null
    ) {
      return null;
    }

    return {
      type: "current" as const,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      label: "Current location",
    };
  }, [userLocation.latitude, userLocation.longitude, userLocation.status]);

  const activeOrigin = storedOrigin ?? deviceOrigin;

  const latitude = activeOrigin?.latitude ?? null;
  const longitude = activeOrigin?.longitude ?? null;

  const journeyQuery = useDirectJourneys(businessId, latitude, longitude);

  useEffect(() => {
    if (!deviceOrigin || storedOrigin?.type === "selected") {
      return;
    }

    if (
      storedOrigin?.latitude === deviceOrigin.latitude &&
      storedOrigin.longitude === deviceOrigin.longitude
    ) {
      return;
    }

    confirmOrigin(businessId, deviceOrigin);
  }, [businessId, confirmOrigin, deviceOrigin, storedOrigin]);

  useQueryErrorNotification({
    error: businessQuery.error,
    toastId: "jeepney-guide-business-error",
    title: "Unable to load destination",
    fallbackMessage: "We couldn't load this business right now.",
  });

  useQueryErrorNotification({
    error: journeyQuery.error,
    toastId: "direct-journeys-error",
    title: "Unable to load jeepney guidance",
    fallbackMessage: "We couldn't check direct jeepney routes right now.",
  });

  if (businessQuery.error && !businessQuery.business) {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
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

  const destinationAddress = business
    ? getBusinessAddressDisplay(business.location).fullAddress
    : null;

  const originState: OriginState =
    activeOrigin?.type === "selected"
      ? "selected"
      : activeOrigin
        ? "current"
        : userLocation.status === "loading"
          ? "loading"
          : "unavailable";

  const originLabel =
    activeOrigin?.label ??
    (userLocation.status === "loading"
      ? "Finding your location…"
      : "Choose a starting point");

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    const isPastStickyThreshold = offsetY > DESTINATION_STICKY_THRESHOLD;

    if (isPastStickyThreshold === wasPastStickyThreshold.current) {
      return;
    }

    wasPastStickyThreshold.current = isPastStickyThreshold;

    Animated.parallel([
      Animated.timing(stickyHeaderOpacity, {
        toValue: isPastStickyThreshold ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(stickyHeaderTranslateY, {
        toValue: isPastStickyThreshold ? 0 : -20,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleViewMap = (journey: DirectJourney) => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/jeepney-route-map",
      params: {
        businessId: String(businessId),
        routeVariantId: String(journey.route_variant_id),
        boardingTransitPointId: String(journey.boarding_transit_point.id),
        alightingTransitPointId: String(journey.alighting_transit_point.id),
      },
    });
  };

  const openStartingPointPicker = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/jeepney-starting-point",
      params: {
        businessId: String(businessId),
      },
    });
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Sticky destination header */}
      {business && (
        <JeepneyDestinationStickyHeader
          businessName={businessName}
          address={destinationAddress}
          coverPhotoUrl={business.cover_photo_url}
          opacity={stickyHeaderOpacity}
          translateY={stickyHeaderTranslateY}
        />
      )}

      {/* Scrollable Jeepney guidance */}
      <Animated.ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={{
          paddingBottom:
            ORIGIN_DOCK_CONTENT_SPACING + Math.max(insets.bottom, 12),
        }}
      >
        {/* Destination */}
        <JeepneyDestinationHeader
          businessName={businessName}
          address={destinationAddress}
          coverPhotoUrl={business?.cover_photo_url ?? null}
          isLoading={businessQuery.isLoading && !business}
        />

        {/* Journey results */}
        <View className="px-screen-x">
          {!activeOrigin && userLocation.status === "loading" ? (
            <GettingThereLoadingState message="Finding your current location…" />
          ) : !activeOrigin &&
            (userLocation.status === "denied" ||
              userLocation.status === "unavailable") ? (
            <LocationUnavailableState
              status={userLocation.status}
              isRetrying={userLocation.isRefreshingLocation}
              onRetry={() => void userLocation.refreshLocation()}
              onChooseStartingPoint={openStartingPointPicker}
            />
          ) : journeyQuery.isLoading && !journeyQuery.result ? (
            <GettingThereLoadingState message="Checking direct jeepney routes…" />
          ) : journeyQuery.error && !journeyQuery.result ? (
            <View className="pt-15">
              <ErrorState
                size="small"
                title="Unable to load jeepney guidance"
                description="We couldn't check direct jeepney routes right now."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void journeyQuery.refetch()}
              />
            </View>
          ) : journeyQuery.routeOptions.length > 0 ? (
            <DirectJourneyList
              routeOptions={journeyQuery.routeOptions}
              onViewMap={handleViewMap}
            />
          ) : journeyQuery.result ? (
            <GettingThereEmptyState
              reason={journeyQuery.reason}
              isLoading={journeyQuery.isFetching}
              onRetry={() => void journeyQuery.refetch()}
            />
          ) : null}

          {/* Approximate-distance clarification */}
          {journeyQuery.routeOptions.length > 0 && (
            <View className="mt-5 flex-row rounded-xl bg-info px-4 py-3">
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={theme.extends.colors.text.info}
              />

              <AppText className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                Access distances are approximate straight-line distances, not
                turn-by-turn walking routes.
              </AppText>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating starting-point dock */}
      <View
        pointerEvents="box-none"
        className="absolute left-4 right-4"
        style={{
          bottom: Math.max(insets.bottom, 18) + 8,
        }}
      >
        <JourneyOriginSelector
          label={originLabel}
          state={originState}
          onPress={openStartingPointPicker}
        />
      </View>
    </View>
  );
}
