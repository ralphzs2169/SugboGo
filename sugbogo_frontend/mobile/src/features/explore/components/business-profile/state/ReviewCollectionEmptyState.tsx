import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");

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
 * Distinguishes a business with no reviews from filtered-empty results and
 * retryable review-list failures.
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
      <View className="mx-4 mt-10 items-center rounded-card bg-surface-secondary p-5">
        {/* Empty reviews illustration */}
        <Image
          source={MASCOT_EMPTY_REVIEWS}
          style={{ width: 120, height: 120 }}
          contentFit="contain"
          accessible={false}
        />

        {/* Empty reviews message */}
        <AppText
          weight="semibold"
          className="mt-2 text-center text-text-primary"
        >
          No reviews yet
        </AppText>

        <AppText className="mt-1 text-center text-text-secondary">
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
            className="mt-5 min-w-44 py-3"
            fontClassName="text-sm"
          />
        )}
      </View>
    );
  }

  if (hasListError) {
    return (
      <View className="mx-4 h-48">
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

  return (
    <View className="mx-4 items-center rounded-card bg-surface-secondary px-5 py-6">
      {/* Empty filtered results */}
      <AppText weight="semibold" className="text-text-primary">
        {hasContentFilters
          ? "No reviews match these filters"
          : "No reviews to show right now"}
      </AppText>

      {hasContentFilters && (
        <>
          <AppText className="mt-1 text-center text-sm text-text-secondary">
            Try changing or clearing your filters.
          </AppText>

          {/* Filter recovery action */}
          <Button
            title="Clear filters"
            onPress={onClearFilters}
            variant="soft"
            rounded="full"
            size="sm"
            className="mt-4"
          />
        </>
      )}
    </View>
  );
}
