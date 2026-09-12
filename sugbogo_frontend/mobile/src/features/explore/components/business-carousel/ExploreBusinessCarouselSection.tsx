import type { LocationObject } from "expo-location";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import BusinessCard from "../new-businesses/BusinessCard";

type Props = {
  title: string;
  subtitle: string;
  businesses: ExploreBusiness[];
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  cardVariant?: "default" | "featured";
  sectionTestID: string;
  scrollTestID: string;
  impressionTestIDPrefix: string;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
  onSeeAll?: () => void;
  seeAllAccessibilityLabel?: string;
};

/**
 * Displays a horizontal Explore business carousel.
 *
 * Preserves backend ordering, calculates optional local distance, and reports
 * card visibility through the shared business impression observer.
 */
export default function ExploreBusinessCarousel({
  title,
  subtitle,
  businesses,
  impressions,
  userLocation,
  cardVariant = "default",
  sectionTestID,
  scrollTestID,
  impressionTestIDPrefix,
  onBusinessPress,
  onSeeAll,
  seeAllAccessibilityLabel,
}: Props) {
  const { retainBusinesses } = impressions;

  useEffect(() => {
    retainBusinesses(businesses.map((business) => business.id));

    return () => {
      retainBusinesses([]);
    };
  }, [businesses, retainBusinesses]);

  return (
    <View
      testID={sectionTestID}
      className="py-6"
      onLayout={impressions.onSectionLayout}
    >
      {/* Section heading */}
      <View className="mb-4 flex-row items-start justify-between gap-4 px-4">
        <View className="min-w-0 flex-1">
          <AppText weight="bold" className="text-xl text-text-primary">
            {title}
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {subtitle}
          </AppText>
        </View>

        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={seeAllAccessibilityLabel}
            hitSlop={8}
            className="cursor-pointer min-h-7 justify-center active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              See all
            </AppText>
          </Pressable>
        )}
      </View>

      {/* Business carousel */}
      <ScrollView
        testID={scrollTestID}
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
              testID={`${impressionTestIDPrefix}-${business.id}`}
              collapsable={false}
              onLayout={(event) => impressions.onCardLayout(business.id, event)}
            >
              <BusinessCard
                business={business}
                distance={distance}
                distanceAccuracy={userLocation?.coords.accuracy ?? null}
                variant={cardVariant}
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
