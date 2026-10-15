import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RefObject } from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import type { ExploreFilterOptions } from "@/features/explore/types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FilterChip from "@/shared/components/FilterChip";
import TaxonomyFilterControls from "@/shared/components/filters/TaxonomyFilterControls";
import {
  retainClusterCategoryIds,
  toggleCategoryId,
} from "@/shared/utils/taxonomyFilters";

import type {
  CommunityReviewFilters,
  CommunityReviewOrdering,
} from "../types/communityReview.types";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  filters: CommunityReviewFilters;
  options: ExploreFilterOptions;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onApply: (filters: CommunityReviewFilters) => void;
};

const SORT_OPTIONS: { label: string; value: CommunityReviewOrdering }[] = [
  { label: "Newest", value: "newest" },
  { label: "Most Helpful", value: "most_helpful" },
];

/** Stages Community taxonomy, content, and sorting choices until Apply. */
export default function CommunityFilterBottomSheet({
  sheetRef,
  filters,
  options,
  isLoading,
  error,
  onRetry,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CommunityReviewFilters>(filters);
  const [search, setSearch] = useState("");
  const hasContentFilters =
    draft.clusterId !== null ||
    draft.categoryIds.length > 0 ||
    draft.specialtyTagId !== null ||
    draft.hasPhotos;

  const selectCluster = (clusterId: number | null) => {
    setDraft((current) => {
      return {
        ...current,
        clusterId,
        categoryIds: retainClusterCategoryIds(
          current.categoryIds,
          clusterId,
          options.categories,
        ),
      };
    });
  };

  const toggleCategory = (categoryId: number) => {
    setDraft((current) => ({
      ...current,
      categoryIds: toggleCategoryId(current.categoryIds, categoryId),
    }));
  };

  const reset = () => {
    setDraft((current) => ({
      ...current,
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
      hasPhotos: false,
    }));
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={["80%"]}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => {
        if (index === 0) {
          setDraft({ ...filters, categoryIds: [...filters.categoryIds] });
          setSearch("");
        }
      }}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      )}
    >
      <View className="flex-1">
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerClassName="px-5 pb-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between border-b border-border-primary pb-4">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-xl text-text-primary"
            >
              Filter reviews
            </AppText>
            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-muted"
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>

          {isLoading && !options.clusters.length && (
            <View className="items-center py-6">
              <ActivityIndicator color={theme.extends.colors.brand} />
              <AppText className="mt-2 text-sm text-text-secondary">
                Loading filter options…
              </AppText>
            </View>
          )}
          {error && (
            <View className="mt-4 flex-row items-center justify-between rounded-xl bg-surface-muted px-4">
              <AppText className="text-sm text-text-secondary">
                Could not load filter options.
              </AppText>
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                className="min-h-11 justify-center px-2"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  Retry
                </AppText>
              </Pressable>
            </View>
          )}

          {/* Taxonomy controls share presentation, not draft ownership. */}
          <TaxonomyFilterControls
            options={options}
            clusterId={draft.clusterId}
            categoryIds={draft.categoryIds}
            specialtyTagId={draft.specialtyTagId}
            query={search}
            onQueryChange={setSearch}
            onClusterSelect={selectCluster}
            onCategoryToggle={toggleCategory}
            onSpecialtySelect={(specialtyTagId) =>
              setDraft((current) => ({ ...current, specialtyTagId }))
            }
            specialtyTitle="Vouched specialty"
            showEmptyStates={!isLoading && !error}
          />

          <View className="pt-6">
            <AppText weight="bold" className="text-base text-text-primary">
              Review content
            </AppText>
            <View className="mt-3 self-start">
              <FilterChip
                label="With photos"
                icon="image-outline"
                selected={draft.hasPhotos}
                showSelectedCheck
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    hasPhotos: !current.hasPhotos,
                  }))
                }
              />
            </View>
          </View>

          <View className="pt-6">
            <AppText weight="bold" className="text-base text-text-primary">
              Sort by
            </AppText>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={draft.ordering === option.value}
                  showSelectedCheck
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      ordering: option.value,
                    }))
                  }
                />
              ))}
            </View>
          </View>
        </BottomSheetScrollView>
        <View
          className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            title="Reset"
            variant="outline"
            rounded="full"
            size="sm"
            disabled={!hasContentFilters}
            onPress={reset}
            className="flex-1"
          />
          <Button
            title="Apply"
            variant="primary"
            rounded="full"
            size="sm"
            onPress={() => {
              onApply(draft);
              sheetRef.current?.dismiss();
            }}
            className="flex-1"
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}
