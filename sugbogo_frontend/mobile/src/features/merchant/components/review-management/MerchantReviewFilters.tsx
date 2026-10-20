import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import ReviewFilterControls from "@/features/explore/components/business-profile/reviews/review-collection/ReviewFilterControls";
import ReviewFilterBottomSheet from "@/features/explore/components/business-profile/reviews/review-collection/ReviewFilterBottomSheet";
import type { BusinessReviewFilters } from "@/features/explore/types/review.types";
import ReviewMentionedAspects from "@/shared/components/reviews/ReviewMentionedAspects";
import ErrorState from "@/shared/components/ErrorState";
import FilterChip from "@/shared/components/FilterChip";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import useMerchantReviewFilterOptions from "../../hooks/review-management/useMerchantReviewFilterOptions";
import type { MerchantReviewSelection } from "../../types/merchantReviews.types";

/** Uses the exact collection row and sheet for content filters and sorting. */
export default function MerchantReviewFilters({
  businessId,
  contentFilters,
  filter,
  ordering,
  onSelectionChange,
  needsReplyCount,
}: MerchantReviewSelection & {
  businessId: number;
  needsReplyCount?: number;
  onSelectionChange: (selection: MerchantReviewSelection) => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const options = useMerchantReviewFilterOptions(businessId, true);
  const filters: BusinessReviewFilters = {
    ...contentFilters,
    merchantReplied: filter === "replied",
    ordering,
  };
  const apply = (next: BusinessReviewFilters) =>
    onSelectionChange({
      filter: next.merchantReplied
        ? "replied"
        : filter === "needs-reply"
          ? "needs-reply"
          : "all",
      ordering: next.ordering,
      contentFilters: {
        sentiment: next.sentiment,
        topic: next.topic,
        hasPhotos: next.hasPhotos,
      },
    });
  const clear = () =>
    onSelectionChange({
      filter: "all",
      ordering,
      contentFilters: { sentiment: null, topic: null, hasPhotos: false },
    });
  useEffect(() => {
    if (
      options.isSuccess &&
      !options.isFetching &&
      !options.error &&
      !options.data?.has_sufficient_sentiment_data &&
      contentFilters.sentiment
    ) {
      onSelectionChange({
        filter,
        ordering,
        contentFilters: { ...contentFilters, sentiment: null },
      });
    }
  }, [
    options.isSuccess,
    options.isFetching,
    options.error,
    options.data,
    contentFilters,
    filter,
    ordering,
    onSelectionChange,
  ]);
  return (
    <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
      <View className="mb-5">
        <ReviewMentionedAspects
          mentions={options.data?.frequent_mentions ?? []}
          selected={contentFilters.topic}
          onChange={(topic) => apply({ ...filters, topic })}
        />
        {!!options.error && (
          <ErrorState
            size="section"
            title="Review filter options unavailable"
            description="Your reviews and current filters remain available."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void options.refetch()}
          />
        )}
      </View>
      <ReviewFilterControls
        filters={filters}
        onChange={apply}
        onClear={clear}
        onOpenFilter={() => presentBottomSheet(sheetRef)}
        additionalActiveFilterCount={filter === "needs-reply" ? 1 : 0}
        additionalFilters={
          <FilterChip
            label="Needs reply"
            count={needsReplyCount}
            selected={filter === "needs-reply"}
            showSelectedCheck
            accessibilityLabel={
              needsReplyCount
                ? "Needs reply, " + needsReplyCount
                : "Needs reply"
            }
            onPress={() =>
              onSelectionChange({
                filter: filter === "needs-reply" ? "all" : "needs-reply",
                ordering,
                contentFilters,
              })
            }
          />
        }
      />
      <ReviewFilterBottomSheet
        sheetRef={sheetRef}
        insights={options.data}
        filters={filters}
        onApply={apply}
      />
    </View>
  );
}
