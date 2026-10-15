import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RefObject } from "react";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import type { ExploreFilterOptions } from "@/features/explore/types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FilterChip from "@/shared/components/FilterChip";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

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

const SEARCH_THRESHOLD = 12;
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
  const normalizedSearch = search.trim().toLowerCase();
  const showSearch =
    options.categories.length + options.specialty_tags.length >
    SEARCH_THRESHOLD;

  const visibleCategories = useMemo(
    () =>
      options.categories.filter(
        (category) =>
          (draft.clusterId === null ||
            category.cluster_id === draft.clusterId) &&
          (!normalizedSearch ||
            category.name.toLowerCase().includes(normalizedSearch)),
      ),
    [options.categories, draft.clusterId, normalizedSearch],
  );
  const visibleSpecialties = useMemo(
    () =>
      options.specialty_tags.filter(
        (specialty) =>
          !normalizedSearch ||
          specialty.name.toLowerCase().includes(normalizedSearch),
      ),
    [options.specialty_tags, normalizedSearch],
  );
  const hasContentFilters =
    draft.clusterId !== null ||
    draft.categoryIds.length > 0 ||
    draft.specialtyTagId !== null ||
    draft.hasPhotos;

  const selectCluster = (clusterId: number | null) => {
    setDraft((current) => {
      const validCategories = new Set(
        options.categories
          .filter(
            (category) =>
              clusterId === null || category.cluster_id === clusterId,
          )
          .map((category) => category.id),
      );
      return {
        ...current,
        clusterId,
        categoryIds: current.categoryIds.filter((id) =>
          validCategories.has(id),
        ),
      };
    });
  };

  const toggleCategory = (categoryId: number) => {
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId],
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
            <AppText weight="bold" className="text-xl text-text-primary">
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

          {showSearch && (
            <View className="mt-4 h-11 flex-row items-center rounded-full border border-border-primary bg-surface-muted px-4">
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={theme.extends.colors.text.tertiary}
              />
              <BottomSheetTextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search categories and specialties"
                placeholderTextColor={theme.extends.colors.text.tertiary}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Search filters"
                style={{
                  flex: 1,
                  marginLeft: 8,
                  paddingVertical: 0,
                  fontSize: 14,
                  color: theme.extends.colors.text.primary,
                }}
              />
            </View>
          )}

          <View className="pt-5">
            <AppText weight="bold" className="text-base text-text-primary">
              Cluster
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-5 mt-3"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {[{ id: null, name: "All" }, ...options.clusters].map(
                (cluster) => (
                  <FilterChip
                    key={cluster.id ?? "all"}
                    label={cluster.name}
                    selected={draft.clusterId === cluster.id}
                    showSelectedCheck
                    onPress={() => selectCluster(cluster.id)}
                  />
                ),
              )}
            </ScrollView>
          </View>

          <View className="pt-6">
            <AppText weight="bold" className="text-base text-text-primary">
              Category
            </AppText>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {visibleCategories.map((category) => (
                <FilterChip
                  key={category.id}
                  label={category.name}
                  selected={draft.categoryIds.includes(category.id)}
                  showSelectedCheck
                  onPress={() => toggleCategory(category.id)}
                />
              ))}
            </View>
            {!visibleCategories.length && !isLoading && !error && (
              <AppText className="mt-2 text-sm text-text-tertiary">
                No categories available.
              </AppText>
            )}
          </View>

          <View className="pt-6">
            <View className="flex-row items-baseline justify-between">
              <AppText weight="bold" className="text-base text-text-primary">
                Vouched specialty
              </AppText>
              <AppText className="text-xs text-text-tertiary">
                Select one
              </AppText>
            </View>
            <View className="mt-3 flex-row flex-wrap">
              <View className="mb-2 mr-2">
                <FilterChip
                  label="Any specialty"
                  selected={draft.specialtyTagId === null}
                  showSelectedCheck
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      specialtyTagId: null,
                    }))
                  }
                />
              </View>
              {visibleSpecialties.map((specialty) => (
                <SpecialtyTagChip
                  key={specialty.id}
                  tag={specialty}
                  mode="filter"
                  size="medium"
                  isSelected={draft.specialtyTagId === specialty.id}
                  showSelectionIndicator
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      specialtyTagId: specialty.id,
                    }))
                  }
                />
              ))}
            </View>
          </View>

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
