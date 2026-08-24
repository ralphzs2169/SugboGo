import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

import ErrorState from "@/shared/components/ErrorState";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";

import useNewBusinesses from "../../hooks/useNewBusinesses";
import NewBusinessCard from "./newBusinessCard";

type Props = {
  onBusinessPress: (businessId: number) => void;
};

/**
 * Displays newly added active businesses from the Explorer API.
 *
 * Business distances are calculated locally from the explorer's current
 * location. Location access is optional, so businesses remain visible when
 * permission is denied or the device location is unavailable.
 */
export default function NewBusinessesSection({ onBusinessPress }: Props) {
  const { businesses, isLoading, error, refetch } = useNewBusinesses();

  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log("LOCATION", {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });

      setUserLocation(location);
    };

    loadLocation();
  }, []);

  if (isLoading) {
    return (
      <View className="mt-6 px-4">
        <View className="mb-3">
          <Text className="text-lg font-bold text-text-primary">
            New Businesses
          </Text>

          <Text className="text-sm text-text-secondary">
            Discover businesses recently added to SugboGo
          </Text>
        </View>

        <View className="h-44 items-center justify-center rounded-card bg-surface">
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="mt-6 px-4">
        <View className="mb-3">
          <Text className="text-lg font-bold text-text-primary">
            New Businesses
          </Text>

          <Text className="text-sm text-text-secondary">
            Discover businesses recently added to SugboGo
          </Text>
        </View>

        <ErrorState
          title="Unable to load new businesses"
          description="We couldn't load the latest businesses. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
        />
      </View>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  return (
    <View className="mt-6">
      {/* Section heading */}
      <View className="mb-3 px-4">
        <Text className="text-lg font-bold text-text-primary">
          New Businesses
        </Text>

        <Text className="text-sm text-text-secondary">
          Discover businesses recently added to SugboGo
        </Text>
      </View>

      {/* Business cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {businesses.map((business) => {
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
            <NewBusinessCard
              key={business.id}
              business={business}
              distance={distance}
              distanceAccuracy={userLocation?.coords.accuracy ?? null}
              onPress={() => onBusinessPress(business.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
