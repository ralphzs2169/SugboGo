import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import useSimilarBusinesses from "../../hooks/useSimilarBusinesses";
import BusinessCard from "../new-businesses/BusinessCard";
import BusinessProfileSection from "./BusinessProfileSection";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import CompactBusinessListSkeleton from "../CompactBusinessListSkeleton";

type Props = {
  businessId: number;
};

const SKELETON_DELAY_MS = 200;

/**
 * Displays compact taxonomy-similar businesses after the profile reviews.
 *
 * Brief requests stay visually quiet, while slower requests show a delayed
 * skeleton. Successful empty responses remove the optional section entirely.
 */
export default function SimilarPlacesSection({ businessId }: Props) {
  const similarBusinesses = useSimilarBusinesses(businessId);
  const { location: userLocation } = useUserLocation();
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);

  useEffect(() => {
    if (!similarBusinesses.error) {
      return;
    }

    const response = similarBusinesses.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load similar places",
        text2: response.message || "Please try again.",
      });
    }
  }, [similarBusinesses.error]);

  useEffect(() => {
    if (!similarBusinesses.isLoading) {
      setShowLoadingSkeleton(false);
      return;
    }

    setShowLoadingSkeleton(false);

    const timeout = setTimeout(() => {
      setShowLoadingSkeleton(true);
    }, SKELETON_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [businessId, similarBusinesses.isLoading]);

  // Avoid flashing an optional section for fast requests.
  if (similarBusinesses.isLoading && !showLoadingSkeleton) {
    return null;
  }

  // Successful responses with no qualifying matches do not reserve space.
  if (
    !similarBusinesses.isLoading &&
    !similarBusinesses.error &&
    similarBusinesses.businesses.length === 0
  ) {
    return null;
  }

  return (
    <BusinessProfileSection
      title="Similar Places"
      icon={
        <MaterialCommunityIcons
          name="tag-multiple-outline"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      }
    >
      {/* Delayed loading state */}
      {similarBusinesses.isLoading ? (
        <CompactBusinessListSkeleton
          count={2}
          testID="similar-places-loading"
          applyXPadding={false}
        />
      ) : similarBusinesses.error ? (
        /* Local request error */
        <View testID="similar-places-error">
          <ErrorState
            title="Unable to load similar places"
            description="We couldn't load these places right now."
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              void similarBusinesses.refetch();
            }}
            size="section"
          />
        </View>
      ) : (
        /* Similar business results */
        <View className="gap-3" testID="similar-places-list">
          {similarBusinesses.businesses.map((business) => {
            const distance = userLocation
              ? calculateDistanceInKm(
                  userLocation.coords.latitude,
                  userLocation.coords.longitude,
                  business.location.latitude,
                  business.location.longitude,
                )
              : null;

            return (
              <BusinessCard
                key={business.id}
                business={business}
                distance={distance}
                distanceAccuracy={userLocation?.coords.accuracy ?? null}
                variant="compact"
                onPress={() => {
                  router.push({
                    pathname: "/(explorer)/business/[businessId]",
                    params: {
                      businessId: String(business.id),
                      distance: distance === null ? "" : String(distance),
                      distanceAccuracy:
                        userLocation?.coords.accuracy === null ||
                        userLocation?.coords.accuracy === undefined
                          ? ""
                          : String(userLocation.coords.accuracy),
                    },
                  });
                }}
              />
            );
          })}
        </View>
      )}
    </BusinessProfileSection>
  );
}
