import type { LocationObject } from "expo-location";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import SafePressable from "@/shared/components/SafePressable";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import type useOpenNowBusinesses from "../../hooks/useOpenNowBusinesses";
import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import ExploreBusinessCarousel from "../business-carousel/ExploreBusinessCarouselSection";
import ExploreBusinessCarouselSkeleton from "../business-carousel/ExploreBusinessCarouselSkeleton";
import ExploreSectionHeader from "../ExploreSectionHeader";
import ExploreSectionEmptyState from "../ExploreSectionEmptyState";

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
 * Explains empty results and retained location or availability
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

  if (!showLoading && userLocation === null) {
    return null;
  }

  const locationNotice =
    hasContent && isUsingLastLocation && userLocation !== null ? (
      <View className="mb-3 px-4" accessibilityLiveRegion="polite">
        <InfoBanner
          title="Using your last known location"
          icon="map-marker-outline"
          variant="info"
        >
          <AppText className="text-sm leading-5 text-text-secondary">
            Couldn’t update your location. Showing places near your last
            location.
          </AppText>
        </InfoBanner>
      </View>
    ) : null;

  if (showLoading || !hasContent) {
    return (
      <View className="py-6" testID="open-now-section">
        {/* Section identity and location context */}
        <ExploreSectionHeader title={TITLE} subtitle={SUBTITLE} />
        {locationNotice}

        {/* Initial loading, request recovery, and empty availability */}
        {showLoading ? (
          <ExploreBusinessCarouselSkeleton variant="default" />
        ) : hasError ? (
          <ErrorState
            title="Unable to load nearby open places"
            description="We couldn't check which places are open nearby."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void feed.refetch()}
            size="section"
            icon="store-off-outline"
          />
        ) : (
          <ExploreSectionEmptyState
            title="No places listed as open nearby"
            description="Check back later for places listed as open within 3 km."
            icon="clock-outline"
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
              <InfoBanner
                title={
                  feed.isPaused
                    ? "You’re offline"
                    : "Couldn’t update availability"
                }
                variant="info"
              >
                <AppText className="text-sm leading-5 text-text-secondary">
                  Showing previously loaded places. Opening status may have
                  changed.
                </AppText>
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry nearby open places"
                  disabled={feed.isFetching}
                  accessibilityState={{ disabled: feed.isFetching }}
                  onPress={() => void feed.refetch()}
                  className="min-h-12 cursor-pointer justify-center self-start py-3 active:opacity-80"
                >
                  <AppText weight="semibold" className="text-sm text-text-info">
                    Retry
                  </AppText>
                </SafePressable>
              </InfoBanner>
            </View>
          )}
        </>
      }
    />
  );
}
