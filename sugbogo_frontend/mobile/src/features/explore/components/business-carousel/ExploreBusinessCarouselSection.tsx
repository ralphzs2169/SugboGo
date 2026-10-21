import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { LocationObject } from "expo-location";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import { calculateDistanceInKm } from "@/shared/utils/distance.utils";
import AppText from "@/shared/components/AppText";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import ExploreSectionHeader from "../ExploreSectionHeader";
import BusinessCard from "@/features/pockets/components/PocketBusinessCard";

type Props = {
  title: string;
  subtitle: string;
  titleIcon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  showHeading?: boolean;
  compactHeading?: boolean;
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
 * Preserves backend ordering, calculates optional local distance, reports
 * impression visibility, and uses the shared Explore section heading.
 */
export default function ExploreBusinessCarousel({
  title,
  subtitle,
  titleIcon,
  showHeading = true,
  compactHeading = false,
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
      className={`bg-surface ${showHeading ? "py-6" : "pb-6 pt-3"}`}
      onLayout={impressions.onSectionLayout}
    >
      {/* Section heading */}
      {showHeading && compactHeading && (
        <AppText
          weight="semibold"
          accessibilityRole="header"
          className="mb-3 px-4 text-base text-text-primary"
        >
          {title}
        </AppText>
      )}
      {showHeading && !compactHeading && (
        <ExploreSectionHeader
          title={title}
          subtitle={subtitle}
          titleIcon={titleIcon}
          onSeeAll={onSeeAll}
          seeAllAccessibilityLabel={seeAllAccessibilityLabel}
        />
      )}

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
