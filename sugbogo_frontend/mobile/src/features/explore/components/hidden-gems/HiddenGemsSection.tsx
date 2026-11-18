import type { LocationObject } from "expo-location";
import { useMemo, useState } from "react";
import { View } from "react-native";

import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import AppText from "@/shared/components/AppText";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreSectionHeader from "../ExploreSectionHeader";
import ExploreSection from "../ExploreSection";
import ExploreBusinessCarouselSkeleton from "../business-carousel/ExploreBusinessCarouselSkeleton";
import HiddenGemSpotlight from "./HiddenGemSpotlight";
import ExploreQueryNotice from "../ExploreQueryNotice";

type Props = {
  offline?: boolean;
  businesses: ExploreBusiness[];
  isLoading: boolean;
  isPaused?: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  impressions: BusinessImpressionObservation;
  spotlightImpressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
};

/**
 * Displays the primary backend-ranked Hidden Gems section.
 *
 * Preserves loading and retry feedback and hides the section when no gems
 * qualify.
 */
export default function HiddenGemsSection({
  offline = false,
  businesses: rankedBusinesses,
  isLoading,
  isPaused = false,
  error,
  refetch,
  impressions,
  spotlightImpressions,
  userLocation,
  onBusinessPress,
}: Props) {
  const [isRetrying, setIsRetrying] = useState(false);
  const businesses = useMemo(
    () => rankedBusinesses.slice(0, 10),
    [rankedBusinesses],
  );

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  if (offline && businesses.length === 0) return null;

  if ((isLoading || isRetrying) && !isPaused && businesses.length === 0) {
    return (
      <ExploreSection>
        {/* Spotlight placeholders match the loaded section's spacing. */}
        <View className="pb-2 pt-6">
          <ExploreSectionHeader
            title="Hidden Gem Spotlight"
            subtitle="Great local places that deserve more discovery."
          />

          {/* Full-width spotlight placeholder */}
          <View className="px-4">
            <Skeleton className="h-72 w-full rounded-card" />
          </View>
        </View>

        {/* Ranked discovery preview */}
        <View className="py-6">
          <AppText
            weight="semibold"
            accessibilityRole="header"
            className="mb-3 px-4 text-base text-text-primary"
          >
            More Hidden Gems
          </AppText>
          <ExploreBusinessCarouselSkeleton hiddenGemsOnly />
        </View>
      </ExploreSection>
    );
  }

  if ((error || isPaused) && businesses.length === 0) {
    return (
      <ExploreSection className="py-6" testID="hidden-gems-error">
        {/* Section heading */}
        <ExploreSectionHeader
          title="Hidden Gems"
          subtitle="Great local places that deserve more discovery."
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
      </ExploreSection>
    );
  }

  if (businesses.length === 0) return null;

  const firstBusiness = businesses[0];
  const spotlight = firstBusiness.display_cover_photo_url ? firstBusiness : null;
  const remainingBusinesses = spotlight ? businesses.slice(1) : businesses;

  return (
    <>
      {!offline && Boolean(error) && (
        <ExploreQueryNotice
          message="Couldn't refresh Hidden Gems. Showing previously loaded places."
          retryLabel="Retry refreshing Hidden Gems"
          onRetry={refetch}
        />
      )}
      {spotlight && (
        <HiddenGemSpotlight
          business={offline ? { ...spotlight, sentiment_rating: undefined } : spotlight}
          impressions={spotlightImpressions}
          userLocation={userLocation}
          onPress={onBusinessPress}
        />
      )}
      {remainingBusinesses.length > 0 && (
        /* Ranked discovery carousel */
        <ExploreBusinessCarousel
          readOnly={offline}
          title={spotlight ? "More Hidden Gems" : "Hidden Gems"}
          compactHeading={Boolean(spotlight)}
          subtitle={
            spotlight ? "" : "Great local places that deserve more discovery."
          }
          businesses={remainingBusinesses}
          hiddenGemsOnly
          impressions={impressions}
          userLocation={userLocation}
          cardVariant={spotlight ? "default" : "featured"}
          sectionTestID="hidden-gems-section"
          scrollTestID="hidden-gems-scroll"
          impressionTestIDPrefix="discovery-impression"
          onBusinessPress={onBusinessPress}
        />
      )}
    </>
  );
}
