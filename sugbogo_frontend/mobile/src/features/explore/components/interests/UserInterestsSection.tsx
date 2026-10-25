import type { LocationObject } from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import useRecommendations from "../../hooks/useRecommendations";
import BusinessCard from "@/features/pockets/components/PocketBusinessCard";
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
 * Displays personalized business recommendations or a compact interest setup card.
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
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await recommendations.refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  const visibleBusinesses = useMemo(
    () =>
      recommendations.isPersonalized
        ? recommendations.businesses.slice(0, PREVIEW_LIMIT)
        : [],
    [recommendations.businesses, recommendations.isPersonalized],
  );

  const showSetup =
    !recommendations.isPersonalized &&
    !recommendations.isLoading &&
    !isRetrying &&
    !recommendations.isPaused &&
    !recommendations.error;

  const showSeeAll =
    onSeeAll !== undefined &&
    recommendations.isPersonalized &&
    visibleBusinesses.length > 0;

  useEffect(() => {
    const displayedIds =
      recommendations.isLoading && visibleBusinesses.length === 0
        ? []
        : visibleBusinesses.map((business) => business.id);

    retainBusinesses(displayedIds);
  }, [recommendations.isLoading, retainBusinesses, visibleBusinesses]);

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
      {!showSetup && (
        <ExploreSectionHeader
          title="For You"
          subtitle="Places connected to your interests and activity."
          onSeeAll={
            showSeeAll ? () => onSeeAll?.("recommendations") : undefined
          }
          seeAllAccessibilityLabel="See all For You recommendations"
        />
      )}

      {/* Recommendation loading */}
      {(recommendations.isLoading || isRetrying) &&
      !recommendations.isPaused &&
      visibleBusinesses.length === 0 ? (
        <CompactBusinessListSkeleton
          count={PREVIEW_LIMIT}
          testID="recommendations-loading"
        />
      ) : (recommendations.error || recommendations.isPaused) &&
        visibleBusinesses.length === 0 ? (
        /* Section recovery */
        <View testID="recommendations-error">
          <ErrorState
            title="Unable to load recommendations"
            description="We couldn't load these places right now."
            icon="heart-off-outline"
            primaryActionTitle="Retry"
            onPrimaryAction={() => void handleRetry()}
            size="section"
          />
        </View>
      ) : showSetup ? (
        /* Personalization setup */
        <View className="mx-4 rounded-card border border-border-primary bg-surface p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <MaterialCommunityIcons
                name="creation-outline"
                size={22}
                color={theme.extends.colors.brand}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View className="min-w-0 flex-1">
              <AppText weight="bold" className="text-lg text-text-primary">
                Make SugboGo yours
              </AppText>
              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                Choose a few interests to get recommendations that better match
                your interests and activity.
              </AppText>
            </View>
          </View>
          <Button
            title="Choose interests"
            size="sm"
            rounded="full"
            iconPosition="right"
            icon={
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={theme.extends.colors.brand}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            }
            variant="soft"
            className="mt-4 min-h-11 self-start"
            onPress={() =>
              router.push({
                pathname: "/profile/your-interests",
                params: { source: "recommendations" },
              })
            }
          />
        </View>
      ) : visibleBusinesses.length === 0 ? (
        /* Empty recommendation state */
        <View testID="recommendations-empty">
          <ExploreSectionEmptyState
            title="No matching places yet"
            description="Your interests and activity help shape future recommendations."
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
