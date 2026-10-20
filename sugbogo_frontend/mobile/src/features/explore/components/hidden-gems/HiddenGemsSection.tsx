import type { LocationObject } from "expo-location";
import { useMemo, useState } from "react";
import { View } from "react-native";

import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreSectionEmptyState from "../ExploreSectionEmptyState";
import ExploreSectionHeader from "../ExploreSectionHeader";
import HiddenGemSpotlight from "./HiddenGemSpotlight";

type Props = {
  businesses: ExploreBusiness[];
  isLoading: boolean;
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
 * Handles loading, recovery, retry, and empty states while delegating
 * successful carousel presentation and impression tracking to shared UI.
 */
export default function HiddenGemsSection({
  businesses: rankedBusinesses,
  isLoading,
  error,
  refetch,
  impressions,
  spotlightImpressions,
  userLocation,
  onBusinessPress,
}: Props) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [failedCover, setFailedCover] = useState<string | null>(null);
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

  if (isLoading || isRetrying) {
    return (
      <View className="py-6">
        <ExploreSectionHeader
          title="Hidden Gems"
          subtitle="Great local places that deserve more discovery."
        />

        {/* Full-width spotlight placeholder */}
        <View className="px-4">
          <Skeleton className="h-72 w-full rounded-card" />
        </View>
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

  const firstBusiness = businesses[0];
  const spotlight =
    firstBusiness.display_cover_photo_url &&
    firstBusiness.display_cover_photo_url !== failedCover
      ? firstBusiness
      : null;
  const remainingBusinesses = spotlight ? businesses.slice(1) : businesses;

  return (
    <>
      {spotlight && (
        <HiddenGemSpotlight
          business={spotlight}
          impressions={spotlightImpressions}
          userLocation={userLocation}
          onCoverError={() => setFailedCover(spotlight.display_cover_photo_url)}
          onPress={onBusinessPress}
        />
      )}
      {remainingBusinesses.length > 0 && (
        /* Ranked discovery carousel */
        <ExploreBusinessCarousel
          title={spotlight ? "More Hidden Gems" : "Hidden Gems"}
          compactHeading={Boolean(spotlight)}
          subtitle={
            spotlight ? "" : "Great local places that deserve more discovery."
          }
          businesses={remainingBusinesses}
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
