import type { LocationObject } from "expo-location";
import { ScrollView, View } from "react-native";
import { useEffect } from "react";

import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import NewBusinessCard from "../new-businesses/newBusinessCard";
import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";

type Props = {
  businesses: ExploreBusiness[];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
};

/**
 * Displays the primary backend-ranked discovery carousel.
 *
 * Cards retain the server order, use the shared business presentation, and
 * report impressions only through the existing visibility observer.
 */
export default function WorthDiscoveringSection({
  businesses,
  isLoading,
  error,
  refetch,
  impressions,
  userLocation,
  onBusinessPress,
}: Props) {
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
      <View className="mt-4 py-6">
        {/* Section heading */}
        <View className="mb-4 px-4">
          <AppText weight="bold" className="text-xl text-text-primary">
            Worth Discovering
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            Community-backed places across Cebu worth exploring.
          </AppText>
        </View>

        {/* Featured loading card */}
        <View className="px-4">
          <Skeleton className="h-80 w-[84%] rounded-card" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="mt-4 py-6" testID="worth-discovering-error">
        {/* Section heading */}
        <View className="mb-2 px-4">
          <AppText weight="bold" className="text-xl text-text-primary">
            Worth Discovering
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            Community-backed places across Cebu worth exploring.
          </AppText>
        </View>

        {/* Section recovery */}
        <ErrorState
          title="Unable to load discoveries"
          description="We couldn't load these places right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
            void refetch();
          }}
          size="section"
        />
      </View>
    );
  }

  if (businesses.length === 0) {
    return (
      <View
        testID="worth-discovering-empty"
        className="mt-4 py-6"
      >
        {/* Section heading */}
        <View className="mb-3 px-4">
          <AppText weight="bold" className="text-xl text-text-primary">
            Worth Discovering
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            Community-backed places across Cebu worth exploring.
          </AppText>
        </View>

        {/* Empty discovery state */}
        <View className="mx-4 rounded-card bg-surface px-4 py-4">
          <AppText weight="semibold" className="text-sm text-text-primary">
            No places to show yet.
          </AppText>

          <AppText className="mt-1 text-xs leading-5 text-text-secondary">
            Check back as more local businesses join SugboGo.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="worth-discovering-section"
      className="mt-4 py-6"
      onLayout={impressions.onSectionLayout}
    >
      {/* Section heading */}
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Worth Discovering
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Community-backed places across Cebu worth exploring.
        </AppText>
      </View>

      {/* Ranked business cards */}
      <ScrollView
        testID="worth-discovering-scroll"
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
              testID={`discovery-impression-${business.id}`}
              collapsable={false}
              onLayout={(event) => impressions.onCardLayout(business.id, event)}
            >
              <NewBusinessCard
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
                variant="featured"
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
