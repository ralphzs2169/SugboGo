import { ScrollView } from "react-native";

import FilterChip from "@/shared/components/FilterChip";

import type { CommunityReviewFilters } from "../types/communityReview.types";

type Props = {
  filters: CommunityReviewFilters;
  hasContentFilters: boolean;
  onOpenFilters: () => void;
  onTogglePhotos: () => void;
  onToggleMostHelpful: () => void;
  onClear: () => void;
};

/**
 * Quick controls under the Community title.
 *
 * Photos and "Most helpful" apply instantly; "Filters" opens the sheet for
 * cluster, category, and specialty choices. The badge counts only what the
 * other chips don't already show.
 */
export default function CommunityFilters({
  filters,
  hasContentFilters,
  onOpenFilters,
  onTogglePhotos,
  onToggleMostHelpful,
  onClear,
}: Props) {
  const sheetFilterCount =
    (filters.clusterId !== null ? 1 : 0) +
    filters.categoryIds.length +
    (filters.specialtyTagId !== null ? 1 : 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 12,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <FilterChip
        label="Filters"
        selected={sheetFilterCount > 0}
        icon="tune-variant"
        count={sheetFilterCount}
        accessibilityLabel={`Filters${
          sheetFilterCount ? `, ${sheetFilterCount} active` : ""
        }`}
        onPress={onOpenFilters}
      />
      <FilterChip
        label="With photos"
        icon="image-outline"
        selected={filters.hasPhotos}
        onPress={onTogglePhotos}
      />
      <FilterChip
        label="Most helpful"
        icon="thumb-up-outline"
        selected={filters.ordering === "most_helpful"}
        onPress={onToggleMostHelpful}
      />
      {hasContentFilters && (
        <FilterChip label="Clear" icon="close" selected={false} onPress={onClear} />
      )}
    </ScrollView>
  );
}
