import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import ErrorState from "@/shared/components/ErrorState";

import useNewBusinesses from "../../hooks/useNewBusinesses";
import NewBusinessCard from "./newBusinessCard";

type Props = {
  onBusinessPress: (businessId: number) => void;
};

/**
 * Displays newly added active businesses from the Explorer API.
 *
 * Handles loading, empty, and error states independently so the rest of the
 * Explore screen remains usable when this section cannot load.
 */
export default function NewBusinessesSection({ onBusinessPress }: Props) {
  const { businesses, isLoading, error, refetch } = useNewBusinesses();

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
        {businesses.map((business) => (
          <NewBusinessCard
            key={business.id}
            business={business}
            onPress={() => onBusinessPress(business.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
