import type { LocationObject } from "expo-location";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import type useOpenNowBusinesses from "../../hooks/useOpenNowBusinesses";
import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreBusinessCarouselSkeleton from "../business-carousel/ExploreBusinessCarouselSkeleton";
import ExploreSectionHeader from "../ExploreSectionHeader";

type Props = {
  feed: ReturnType<typeof useOpenNowBusinesses>;
  userLocation: LocationObject | null;
  isLocating: boolean;
  isUsingLastLocation: boolean;
  impressions: BusinessImpressionObservation;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
};

const TITLE = "Open Now Near You";
const SUBTITLE = "Discover places open within 3 km, based on listed hours.";

/**
 * Presents up to six nearby open places using Explore's existing carousel.
 *
 * Hides successful empty results and explains retained location or availability
 * after refresh failures while preserving retry access.
 */
export default function OpenNowBusinessesSection({
  feed,
  userLocation,
  isLocating,
  isUsingLastLocation,
  impressions,
  onBusinessPress,
}: Props) {
  const hasContent = feed.businesses.length > 0;
  const hasError = Boolean(feed.error || feed.isPaused);
  const showLoading =
    !hasContent && !feed.isPaused && (isLocating || feed.isLoading);

  useApiErrorNotification({
    error: feed.error,
    toastId: "open-now-businesses-error",
    title: "Unable to load nearby open places",
    fallbackMessage: "Please try again.",
  });

  if (!showLoading && (userLocation === null || (!hasContent && !hasError))) {
    return null;
  }

  const locationNotice =
    isUsingLastLocation && userLocation !== null ? (
      <AppText
        accessibilityLiveRegion="polite"
        className="mb-3 px-4 text-sm text-text-secondary"
      >
        Couldn’t update your location. Showing places near your last location.
      </AppText>
    ) : null;

  if (showLoading || !hasContent) {
    return (
      <View className="py-6" testID="open-now-section">
        {/* Section identity and location context */}
        <ExploreSectionHeader title={TITLE} subtitle={SUBTITLE} />
        {locationNotice}

        {/* Initial loading and localized recovery */}
        {showLoading ? (
          <ExploreBusinessCarouselSkeleton variant="default" />
        ) : (
          <ErrorState
            title="Unable to load nearby open places"
            description="We couldn't check which places are open nearby."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void feed.refetch()}
            size="section"
            icon="store-off-outline"
          />
        )}
      </View>
    );
  }

  return (
    /* Ranked discovery preview and availability context */
    <ExploreBusinessCarousel
      title={TITLE}
      subtitle={SUBTITLE}
      businesses={feed.businesses}
      impressions={impressions}
      userLocation={userLocation}
      cardVariant="default"
      availabilityLabel={hasError ? undefined : "Open now"}
      sectionTestID="open-now-section"
      scrollTestID="open-now-scroll"
      impressionTestIDPrefix="open-now-impression"
      onBusinessPress={onBusinessPress}
      headerContent={
        <>
          {locationNotice}
          {hasError && (
            <View className="mb-3 px-4">
              <AppText className="text-sm text-text-secondary">
                Couldn’t refresh opening hours. Availability may have changed.
              </AppText>
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Retry nearby open places"
                disabled={feed.isFetching}
                accessibilityState={{ disabled: feed.isFetching }}
                onPress={() => void feed.refetch()}
                className="min-h-12 cursor-pointer justify-center py-3 active:opacity-80"
              >
                <AppText className="text-sm text-brand">Retry</AppText>
              </SafePressable>
            </View>
          )}
        </>
      }
    />
  );
}
