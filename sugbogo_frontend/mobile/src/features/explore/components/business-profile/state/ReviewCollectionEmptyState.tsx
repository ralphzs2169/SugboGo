import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");
const MASCOT_NO_FILTER_RESULT = require("@/shared/assets/mascot/mascot-no-filter-result.webp");

type Props = {
  totalCount: number;
  hasListError: boolean;
  hasContentFilters: boolean;
  canWriteReview: boolean;
  isOwnBusiness: boolean;
  onCreateReview: () => void;
  onClearFilters: () => void;
  onRetry: () => void;
};

/**
 * Displays the appropriate empty or failed state for the full reviews list.
 *
 * Distinguishes businesses with no reviews from filtered-empty results and
 * retryable review-list failures while providing the relevant recovery action.
 */
export default function ReviewCollectionEmptyState({
  totalCount,
  hasListError,
  hasContentFilters,
  canWriteReview,
  isOwnBusiness,
  onCreateReview,
  onClearFilters,
  onRetry,
}: Props) {
  if (totalCount === 0) {
    return (
      <View className="items-center px-8 py-10" testID="reviews-empty">
        {/* Empty reviews illustration */}
        <Image
          source={MASCOT_EMPTY_REVIEWS}
          style={{
            width: 120,
            height: 120,
          }}
          contentFit="contain"
          accessible={false}
        />

        {/* Empty reviews message */}
        <AppText
          weight="bold"
          className="mt-2 text-center text-md text-text-primary"
        >
          No reviews yet
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          {isOwnBusiness
            ? "Reviews from Explorers will show up here."
            : "Be the first to share your experience."}
        </AppText>

        {/* Review creation action */}
        {canWriteReview && (
          <Button
            title="Write a review"
            onPress={onCreateReview}
            rounded="full"
            className="mt-5 min-w-44 cursor-pointer py-3"
            fontClassName="text-sm"
          />
        )}
      </View>
    );
  }

  if (hasListError) {
    return (
      <View className="mx-4 h-48" testID="reviews-error">
        {/* Review loading failure */}
        <ErrorState
          size="section"
          title="Unable to load reviews"
          description="Please try again with the selected filters."
          primaryActionTitle="Retry"
          onPrimaryAction={onRetry}
        />
      </View>
    );
  }

  if (hasContentFilters) {
    return (
      <View className="items-center px-8 py-10" testID="reviews-filter-empty">
        {/* Filtered-empty illustration */}
        <Image
          source={MASCOT_NO_FILTER_RESULT}
          style={{
            width: 120,
            height: 120,
          }}
          contentFit="contain"
          accessible={false}
        />

        {/* Filtered-empty message */}
        <AppText
          weight="bold"
          className="mt-2 text-center text-md text-text-primary"
        >
          No reviews match these filters
        </AppText>

        <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
          Try changing or clearing your filters.
        </AppText>

        {/* Filter recovery action */}
        <Button
          title="Clear filters"
          onPress={onClearFilters}
          variant="soft"
          rounded="full"
          size="sm"
          className="mt-4 cursor-pointer"
        />
      </View>
    );
  }

  return (
    <View className="items-center px-8 py-10" testID="reviews-empty-fallback">
      {/* Fallback empty state */}
      <Image
        source={MASCOT_EMPTY_REVIEWS}
        style={{
          width: 100,
          height: 100,
        }}
        contentFit="contain"
        accessible={false}
      />

      <AppText
        weight="bold"
        className="mt-2 text-center text-md text-text-primary"
      >
        No reviews to show right now
      </AppText>

      <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
        Check back again later.
      </AppText>
    </View>
  );
}
