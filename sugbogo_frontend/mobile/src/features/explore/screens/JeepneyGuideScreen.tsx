import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import DirectJourneyList from "../components/getting-there/DirectJourneyList";
import GettingThereEmptyState from "../components/getting-there/GettingThereEmptyState";
import GettingThereLoadingState from "../components/getting-there/GettingThereLoadingState";
import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import useDirectJourneys from "../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import type { DirectJourney } from "../types/directJourney.types";

type Props = {
  businessId: number;
};

/**
 * Displays direct jeepney guidance from a confirmed Explorer starting point.
 *
 * Device location remains the automatic default while a confirmed manual
 * origin survives navigation to the picker and selected-journey map.
 */
export default function JeepneyGuideScreen({ businessId }: Props) {
  const businessQuery = useExploreBusinessProfile(businessId);
  const userLocation = useUserLocation();
  const originBusinessId = useJourneyOriginStore((state) => state.businessId);
  const confirmedOrigin = useJourneyOriginStore(
    (state) => state.confirmedOrigin,
  );
  const confirmOrigin = useJourneyOriginStore((state) => state.confirmOrigin);
  const storedOrigin =
    originBusinessId === businessId ? confirmedOrigin : null;
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
  }, [
    userLocation.latitude,
    userLocation.longitude,
    userLocation.status,
  ]);
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
      pathname:
        "/(explorer)/business/[businessId]/jeepney-starting-point",
      params: {
        businessId: String(businessId),
      },
    });
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
          {/* Destination banner */}
          <View className="relative h-44 w-full bg-surface-secondary">
            {businessQuery.isLoading && !business ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : business?.cover_photo_url ? (
              <Image
                source={{
                  uri: business.cover_photo_url,
                }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-brand/10">
                <MaterialCommunityIcons
                  name="store-outline"
                  size={52}
                  color={theme.extends.colors.brand}
                  style={{
                    opacity: 0.45,
                  }}
                />
              </View>
            )}

            <LinearGradient
              colors={[
                "rgba(0,0,0,0.25)",
                "rgba(0,0,0,0.02)",
                "rgba(0,0,0,0.2)",
                "rgba(0,0,0,0.78)",
              ]}
              locations={[0, 0.28, 0.58, 1]}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
              pointerEvents="none"
            />

            {/* Destination identity */}
            <View className="absolute bottom-4 left-5 right-5">
              <View className="mb-1.5 flex-row items-center">
                <MaterialCommunityIcons name="bus" size={14} color="#FFFFFF" />

                <AppText
                  weight="bold"
                  className="ml-1.5 text-[11px] uppercase tracking-wide text-white/90"
                >
                  Jeepney Guide
                </AppText>
              </View>

              {businessQuery.isLoading && !business ? (
                <Skeleton className="h-6 w-3/4 rounded-md" />
              ) : (
                <AppText
                  weight="extrabold"
                  className="text-xl text-white"
                  numberOfLines={2}
                >
                  {businessName}
                </AppText>
              )}
            </View>
          </View>

          {/* Direct-route heading */}
          <View className="px-screen-x pb-3 pt-5">
            <AppText weight="bold" className="text-lg text-text-primary">
              Direct Jeepney Routes
            </AppText>

            <AppText className="mt-1 text-sm text-text-secondary">
              Find a direct jeepney route to this destination.
            </AppText>
          </View>

          {/* Starting-point selector */}
          <View className="px-screen-x pb-5">
            <View className="rounded-2xl border border-border-primary bg-surface px-4 py-3.5">
              <View className="mb-2 flex-row items-center justify-between">
                <AppText
                  weight="bold"
                  className="text-xs uppercase tracking-wide text-text-secondary"
                >
                  Starting from
                </AppText>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change starting point"
                  onPress={openStartingPointPicker}
                  className="cursor-pointer rounded-lg px-2 py-1 active:bg-surface-secondary"
                >
                  <AppText weight="bold" className="text-sm text-brand">
                    Change
                  </AppText>
                </Pressable>
              </View>

              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                  <MaterialCommunityIcons
                    name={
                      activeOrigin?.type === "selected"
                        ? "map-marker-outline"
                        : "crosshairs-gps"
                    }
                    size={21}
                    color={theme.extends.colors.brand}
                  />
                </View>

                <View className="ml-3 flex-1">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    {activeOrigin?.label ?? "Current location"}
                  </AppText>

                  <AppText className="mt-0.5 text-xs text-text-secondary">
                    {activeOrigin?.type === "selected"
                      ? "Using a selected starting point"
                      : "Using your device location"}
                  </AppText>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={21}
                  color={theme.extends.colors.text.secondary}
                />
              </View>
            </View>
          </View>

          {/* Location and journey states */}
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
              <ErrorState
                size="small"
                title="Unable to load jeepney guidance"
                description="We couldn't check direct jeepney routes right now."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void journeyQuery.refetch()}
              />
            ) : journeyQuery.routeOptions.length > 0 ? (
              <DirectJourneyList
                routeOptions={journeyQuery.routeOptions}
                onViewMap={handleViewMap}
              />
            ) : journeyQuery.result ? (
              <GettingThereEmptyState
                reason={journeyQuery.reason}
                onRetry={() => void journeyQuery.refetch()}
              />
            ) : null}

            {/* Distance clarification */}
            {journeyQuery.routeOptions.length > 0 && (
              <View className="mt-5 flex-row rounded-xl bg-info px-4 py-3">
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={theme.extends.colors.text.info}
                />

                <AppText className="ml-2 flex-1 text-xs leading-4 text-text-info">
                  Access distances are approximate straight-line distances, not
                  turn-by-turn walking routes.
                </AppText>
              </View>
            )}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}
