import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LocationObject } from "expo-location";
import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import useRecommendations from "../../hooks/useRecommendations";
import BusinessCard from "../new-businesses/BusinessCard";

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

const PREVIEW_LIMIT = 3;

/**
 * Displays a compact preview of personalized business recommendations.
 *
 * The section preserves backend ranking, limits the Explore preview to the
 * strongest results, and keeps its loading and recovery states independent.
 */
export default function InterestsSection({
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
    onSeeAll !== undefined && recommendations.businesses.length > PREVIEW_LIMIT;

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
      {/* Section header */}
      <View className="mb-4 flex-row items-start justify-between gap-4 px-4">
        <View className="min-w-0 flex-1">
          <AppText weight="bold" className="text-xl text-text-primary">
            Based on Your Interests
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            Places matched to what you enjoy.
          </AppText>
        </View>

        {showSeeAll && (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel="See all recommended businesses"
            hitSlop={8}
            className="mt-1 cursor-pointer flex-row items-center py-1 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              See all
            </AppText>

            <MaterialCommunityIcons
              name="chevron-right"
              size={17}
              color={theme.extends.colors.brand}
            />
          </Pressable>
        )}
      </View>

      {/* Recommendation content */}
      {recommendations.isLoading ? (
        <View className="gap-3 px-4" testID="recommendations-loading">
          <Skeleton className="h-[130px] w-full rounded-card" />
          <Skeleton className="h-[130px] w-full rounded-card" />
          <Skeleton className="h-[130px] w-full rounded-card" />
        </View>
      ) : recommendations.error ? (
        <View testID="recommendations-error">
          <ErrorState
            title="Unable to load recommendations"
            description="We couldn't load these places right now."
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              void recommendations.refetch();
            }}
            size="section"
          />
        </View>
      ) : visibleBusinesses.length === 0 ? (
        <View
          className="mx-4 rounded-card border border-border-primary bg-surface px-4 py-4"
          testID="recommendations-empty"
        >
          <AppText weight="semibold" className="text-sm text-text-primary">
            No matching places yet.
          </AppText>

          <AppText className="mt-1 text-xs leading-5 text-text-secondary">
            Keep exploring and we&apos;ll learn what you like.
          </AppText>
        </View>
      ) : (
        <View
          className="gap-3 px-4"
          testID="recommendations-list"
          onLayout={impressions.onListLayout}
        >
          {/* Server-ranked recommendation preview */}
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
                  onPress={() => {
                    onBusinessPress(
                      business.id,
                      distance,
                      userLocation?.coords.accuracy ?? null,
                    );
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
