import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import useSimilarBusinesses from "../../hooks/useSimilarBusinesses";
import BusinessCard from "../new-businesses/BusinessCard";
import BusinessProfileSection from "./BusinessProfileSection";

type Props = {
  businessId: number;
};

/**
 * Displays compact taxonomy-similar businesses after the profile reviews.
 *
 * Loading and failure recovery stay local to this supplemental section, while
 * an empty successful response removes the section from the profile entirely.
 */
export default function SimilarPlacesSection({ businessId }: Props) {
  const similarBusinesses = useSimilarBusinesses(businessId);
  const { location: userLocation } = useUserLocation();

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

  if (
    !similarBusinesses.isLoading &&
    !similarBusinesses.error &&
    similarBusinesses.businesses.length === 0
  ) {
    return null;
  }

  return (
    <BusinessProfileSection title="Similar Places">
      {/* Section content */}
      {similarBusinesses.isLoading ? (
        <View className="gap-3" testID="similar-places-loading">
          <Skeleton className="h-[130px] w-full rounded-card" />
          <Skeleton className="h-[130px] w-full rounded-card" />
        </View>
      ) : similarBusinesses.error ? (
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
        <View className="gap-3" testID="similar-places-list">
          {/* Similar business cards */}
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
