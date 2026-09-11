import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { LocationObject } from "expo-location";
import { useEffect } from "react";

import ErrorState from "@/shared/components/ErrorState";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import useNewBusinesses from "../../hooks/useNewBusinesses";
import BusinessCard from "./BusinessCard";
import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import AppText from "@/shared/components/AppText";

type Props = {
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
};

/**
 * Displays newly added active businesses from the Explorer API.
 *
 * Business distances are calculated locally from the explorer's current
 * location. Card container layouts feed screen-level visibility observation.
 * Location access is optional, so businesses remain visible when
 * permission is denied or the device location is unavailable.
 */
export default function NewBusinessesSection({
  onBusinessPress,
  impressions,
  userLocation,
}: Props) {
  const { businesses, isLoading, error, refetch } = useNewBusinesses();

  const { retainBusinesses } = impressions;

  useEffect(() => {
    const displayedIds =
      error || isLoading ? [] : businesses.map((business) => business.id);

    retainBusinesses(displayedIds);
  }, [businesses, error, isLoading, retainBusinesses]);

  useEffect(() => {
    return () => retainBusinesses([]);
  }, [retainBusinesses]);

  if (isLoading) {
    return (
      <View className="mt-6 px-4">
        <View className="mb-3">
          <AppText weight="bold" className="text-lg text-text-primary">
            New to SugboGo
          </AppText>

          <AppText className="text-sm text-text-secondary">
            Recently added places waiting to be discovered.
          </AppText>
        </View>

        <View className="h-44 items-center justify-center rounded-card bg-surface">
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="mt-6 px-4">
        <View className="mb-3">
          <AppText weight="bold" className="text-lg text-text-primary">
            New to SugboGo
          </AppText>

          <AppText className="text-sm text-text-secondary">
            Recently added places waiting to be discovered.
          </AppText>
        </View>

        <ErrorState
          title="Unable to load new businesses"
          description="We couldn't load the latest businesses. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
        />
      </View>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  return (
    <View
      testID="new-businesses-section"
      className="mt-6 py-6 bg-surface"
      onLayout={impressions.onSectionLayout}
    >
      {/* Section heading */}
      <View className="mb-3 px-4">
        <AppText weight="bold" className="text-lg text-text-primary">
          New to SugboGo
        </AppText>

        <AppText className="text-sm text-text-secondary">
          Recently added places waiting to be discovered.
        </AppText>
      </View>

      {/* Business cards */}
      <ScrollView
        testID="new-businesses-scroll"
        onLayout={impressions.onListLayout}
        onScroll={impressions.onHorizontalScroll}
        scrollEventThrottle={16}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {businesses.map((business) => {
          const distance =
            userLocation !== null
              ? calculateDistanceInKm(
                  userLocation.coords.latitude,
                  userLocation.coords.longitude,
                  business.location.latitude,
                  business.location.longitude,
                )
              : null;

          return (
            <View
              key={business.id}
              testID={`business-impression-${business.id}`}
              collapsable={false}
              onLayout={(event) => impressions.onCardLayout(business.id, event)}
            >
              <BusinessCard
                business={business}
                distance={distance}
                distanceAccuracy={userLocation?.coords.accuracy ?? null}
                onPress={() =>
                  onBusinessPress(
                    business.id,
                    distance,
                    userLocation?.coords.accuracy ?? null,
                  )
                }
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
