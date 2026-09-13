import type { LocationObject } from "expo-location";
import { useState } from "react";
import { View } from "react-native";

import ErrorState from "@/shared/components/ErrorState";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import useNewBusinesses from "../../hooks/useNewBusinesses";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreBusinessCarouselSkeleton from "../business-carousel/ExploreBusinessCarouselSkeleton";
import ExploreSectionHeader from "../ExploreSectionHeader";

type Props = {
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
  onSeeAll?: () => void;
};

/**
 * Displays recently added businesses on the Explore homepage.
 *
 * Handles loading, recovery, and empty availability while delegating successful
 * horizontal business presentation and impression tracking to the shared carousel.
 */
export default function NewBusinessesSection({
  onBusinessPress,
  impressions,
  userLocation,
  onSeeAll,
}: Props) {
  const { businesses, isLoading, error, refetch } = useNewBusinesses();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading || isRetrying) {
    return (
      <View className="py-6">
        {/* Section heading */}
        <ExploreSectionHeader
          title="New to SugboGo"
          subtitle="Recently added places waiting to be discovered."
        />

        {/* Business placeholders */}
        <ExploreBusinessCarouselSkeleton variant="default" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="py-6">
        {/* Section heading */}
        <ExploreSectionHeader
          title="New to SugboGo"
          subtitle="Recently added places waiting to be discovered."
        />

        {/* Section recovery */}
        <ErrorState
          title="Unable to load new businesses"
          description="We couldn't load the latest businesses. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void handleRetry()}
          size="section"
          icon="store-off-outline"
        />
      </View>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  return (
    /* Recently added business carousel */
    <ExploreBusinessCarousel
      title="New to SugboGo"
      subtitle="Recently added places waiting to be discovered."
      businesses={businesses}
      impressions={impressions}
      userLocation={userLocation}
      cardVariant="default"
      sectionTestID="new-businesses-section"
      scrollTestID="new-businesses-scroll"
      impressionTestIDPrefix="business-impression"
      onBusinessPress={onBusinessPress}
      onSeeAll={onSeeAll}
      seeAllAccessibilityLabel="See all new businesses"
    />
  );
}
