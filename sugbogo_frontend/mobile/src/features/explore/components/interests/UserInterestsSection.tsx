import type { LocationObject } from "expo-location";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import useRecommendations from "../../hooks/useRecommendations";
import BusinessCard from "../new-businesses/BusinessCard";
import ExploreSectionHeader from "../ExploreSectionHeader";
import CompactBusinessListSkeleton from "../CompactBusinessListSkeleton";
import ExploreSectionEmptyState from "../ExploreSectionEmptyState";

type Props = {
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onBusinessPress: (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => void;
  onSeeAll?: (source: "recommendations") => void;
};

const PREVIEW_LIMIT = 3;

/**
 * Displays a compact preview of personalized business recommendations.
 *
 * Preserves backend ranking, limits the homepage preview to the strongest
 * matches, and keeps recommendation loading and recovery local to the section.
 */
export default function UserInterestsSection({
  impressions,
  userLocation,
  onBusinessPress,
  onSeeAll,
}: Props) {
  const recommendations = useRecommendations();
  const { retainBusinesses } = impressions;

  const visibleBusinesses = useMemo(
    () => recommendations.businesses.slice(0, PREVIEW_LIMIT),
    [recommendations.businesses],
  );

  const showSeeAll =
    onSeeAll !== undefined &&
    visibleBusinesses.some(
      (business) => business.recommendation_reason !== null,
    );

  useEffect(() => {
    const displayedIds =
      recommendations.error || recommendations.isLoading
        ? []
        : visibleBusinesses.map((business) => business.id);

    retainBusinesses(displayedIds);
  }, [
    recommendations.error,
    recommendations.isLoading,
    retainBusinesses,
    visibleBusinesses,
  ]);

  useEffect(() => {
    return () => retainBusinesses([]);
  }, [retainBusinesses]);

  useEffect(() => {
    if (!recommendations.error) {
      return;
    }

    const response = recommendations.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load recommendations",
        text2: response.message || "Please try again.",
      });
    }
  }, [recommendations.error]);

  return (
    <View
      className="py-6"
      testID="recommendations-section"
      onLayout={impressions.onSectionLayout}
    >
      {/* Section heading */}
      <ExploreSectionHeader
        title="Based on Your Interests"
        subtitle="Places matched to what you enjoy."
        onSeeAll={showSeeAll ? () => onSeeAll?.("recommendations") : undefined}
        seeAllAccessibilityLabel="See all places based on your interests"
      />

      {/* Recommendation loading */}
      {recommendations.isLoading ? (
        <CompactBusinessListSkeleton
          count={PREVIEW_LIMIT}
          testID="recommendations-loading"
        />
      ) : recommendations.error ? (
        /* Section recovery */
        <View testID="recommendations-error">
          <ErrorState
            title="Unable to load recommendations"
            description="We couldn't load these places right now."
            icon="heart-off-outline"
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              void recommendations.refetch();
            }}
            isRetrying={recommendations.isRefetching}
            size="section"
          />
        </View>
      ) : visibleBusinesses.length === 0 ? (
        /* Empty recommendation state */
        <View testID="recommendations-empty">
          <ExploreSectionEmptyState
            title="No matching places yet"
            description="Keep exploring and we'll learn what you like."
            icon="heart-outline"
          />
        </View>
      ) : (
        /* Server-ranked recommendation preview */
        <View
          className="gap-3 px-4"
          testID="recommendations-list"
          onLayout={impressions.onListLayout}
        >
          {visibleBusinesses.map((business) => {
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
                testID={`recommendation-impression-${business.id}`}
                collapsable={false}
                onLayout={(event) =>
                  impressions.onCardLayout(business.id, event)
                }
              >
                <BusinessCard
                  business={business}
                  distance={distance}
                  distanceAccuracy={userLocation?.coords.accuracy ?? null}
                  variant="compact"
                  recommendationReason={business.recommendation_reason}
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
        </View>
      )}
    </View>
  );
}
