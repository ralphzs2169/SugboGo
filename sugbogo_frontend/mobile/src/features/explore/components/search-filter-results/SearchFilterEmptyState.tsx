import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import CompactBusinessListSkeleton from "../CompactBusinessListSkeleton";

const MASCOT_NO_FILTER_RESULT = require("@/shared/assets/mascot/mascot-no-filter-result.webp");

type Props = {
  isLoading: boolean;
  hasError: boolean;
  hasSearch: boolean;
  onRetry: () => void;
  onGoBack: () => void;
};

/**
 * Displays loading, error, and empty states for search and filter results.
 *
 * Uses the SugboGo mascot for empty results while keeping request failures
 * visually distinct through the standard recoverable error state.
 */
export default function SearchFilterEmptyState({
  isLoading,
  hasError,
  hasSearch,
  onRetry,
  onGoBack,
}: Props) {
  if (isLoading) {
    return (
      <CompactBusinessListSkeleton testID="search-filter-results-loading" />
    );
  }

  if (hasError) {
    return (
      <View className="min-h-[420px]" testID="search-filter-results-error">
        {/* Request failure */}
        <ErrorState
          title="Unable to load places"
          description="We couldn't load these results. Please try again."
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
    <View
      className="items-center px-8 py-14"
      testID="search-filter-results-empty"
    >
      {/* Empty-state mascot */}
      <Image
        source={MASCOT_NO_FILTER_RESULT}
        style={{
          width: 120,
          height: 120,
        }}
        contentFit="contain"
      />

      {/* Empty-state message */}
      <AppText
        weight="bold"
        className="mt-3 text-center text-md text-text-primary"
      >
        {hasSearch ? "No places found" : "No places match these filters"}
      </AppText>

      <AppText className="mt-1.5 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {hasSearch
          ? "Try another search or adjust your filters."
          : "Try adjusting or clearing a filter."}
      </AppText>
    </View>
  );
}
