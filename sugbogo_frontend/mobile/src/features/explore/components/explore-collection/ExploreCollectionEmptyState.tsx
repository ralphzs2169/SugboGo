import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import ExploreCollectionSkeleton from "./ExploreCollectionSkeleton";

const MASCOT_NO_FILTER_RESULT = require("@/shared/assets/mascot/mascot-no-filter-result.webp");

type Props = {
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onGoBack: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * Displays the non-content states for an Explore collection.
 *
 * Shows collection skeletons during initial or filtered loading, a retryable
 * error state with navigation recovery, and a mascot when filters return no places.
 */
export default function ExploreCollectionEmptyState({
  isLoading,
  hasError,
  onRetry,
  onGoBack,
  emptyTitle = "No places match these filters",
  emptyDescription = "Try adjusting or clearing a filter.",
}: Props) {
  if (isLoading) {
    return <ExploreCollectionSkeleton />;
  }

  if (hasError) {
    return (
      <View className="min-h-[420px]" testID="collection-error">
        {/* Request error */}
        <ErrorState
          title="Unable to load places"
          description="We couldn't load this collection. Please try again."
          icon="map-marker-off-outline"
          primaryActionTitle="Retry"
          onPrimaryAction={onRetry}
          secondaryActionTitle="Go back"
          onSecondaryAction={onGoBack}
        />
      </View>
    );
  }

  return (
    <View className="items-center px-8 py-10" testID="collection-empty">
      {/* Empty-result mascot */}
      <Image
        source={MASCOT_NO_FILTER_RESULT}
        style={{
          width: 120,
          height: 120,
        }}
        contentFit="contain"
      />

      {/* Empty-result message */}
      <AppText
        weight="bold"
        className="mt-2 text-center text-md text-text-primary"
      >
        {emptyTitle}
      </AppText>

      <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {emptyDescription}
      </AppText>
    </View>
  );
}
