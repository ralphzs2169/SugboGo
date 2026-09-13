import type { LocationObject } from "expo-location";
import { useState } from "react";
import { View } from "react-native";

import ErrorState from "@/shared/components/ErrorState";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreBusinessCarouselSkeleton from "../business-carousel/ExploreBusinessCarouselSkeleton";
import ExploreSectionEmptyState from "../ExploreSectionEmptyState";
import ExploreSectionHeader from "../ExploreSectionHeader";

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
  onSeeAll?: () => void;
};

/**
 * Displays the primary backend-ranked Hidden Gems section.
 *
 * Handles loading, recovery, retry, and empty states while delegating
 * successful carousel presentation and impression tracking to shared UI.
 */
export default function HiddenGemsSection({
  businesses,
  isLoading,
  error,
  refetch,
  impressions,
  userLocation,
  onBusinessPress,
  onSeeAll,
}: Props) {
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
        <ExploreSectionHeader
          title="Hidden Gems"
          subtitle="Great local places that deserve more discovery."
          titleIcon="diamond-stone"
        />

        {/* Featured business placeholders */}
        <ExploreBusinessCarouselSkeleton variant="featured" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="py-6" testID="hidden-gems-error">
        {/* Section heading */}
        <ExploreSectionHeader
          title="Hidden Gems"
          subtitle="Great local places that deserve more discovery."
          titleIcon="diamond-stone"
        />

        {/* Section recovery */}
        <ErrorState
          title="Unable to load discoveries"
          description="We couldn't load these places right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void handleRetry()}
          size="section"
          icon="compass-off-outline"
        />
      </View>
    );
  }

  if (businesses.length === 0) {
    return (
      <View className="py-6" testID="hidden-gems-empty">
        {/* Section heading */}
        <ExploreSectionHeader
          title="Hidden Gems"
          subtitle="Great local places that deserve more discovery."
          titleIcon="diamond-stone"
        />

        {/* Empty discovery state */}
        <ExploreSectionEmptyState
          title="No places to show yet"
          description="Check back as more local businesses join SugboGo."
          icon="compass-outline"
        />
      </View>
    );
  }

  return (
    /* Ranked discovery carousel */
    <ExploreBusinessCarousel
      title="Hidden Gems"
      subtitle="Great local places that deserve more discovery."
      titleIcon="diamond-stone"
      businesses={businesses}
      impressions={impressions}
      userLocation={userLocation}
      cardVariant="featured"
      sectionTestID="hidden-gems-section"
      scrollTestID="hidden-gems-scroll"
      impressionTestIDPrefix="discovery-impression"
      onBusinessPress={onBusinessPress}
      onSeeAll={onSeeAll}
      seeAllAccessibilityLabel="See all Hidden Gems"
    />
  );
}
