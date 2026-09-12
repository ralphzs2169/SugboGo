import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

import type {
  ExploreFilterOptions,
  ExploreResultsCriteria,
} from "../../types/exploreBusiness.types";
import {
  applyClusterSelection,
  toggleCategorySelection,
  toggleSpecialtySelection,
} from "../../utils/exploreResultsCriteria";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  options: ExploreFilterOptions;
  draft: ExploreResultsCriteria;
  onChange: (criteria: ExploreResultsCriteria) => void;
  onApply: () => void;
};

/**
 * Provides draft taxonomy filters for Explore results.
 *
 * Filter controls remain scrollable while the reset and apply actions stay
 * fixed and safely positioned above the device bottom inset.
 */
export default function ExploreFiltersSheet({
  sheetRef,
  options,
  draft,
  onChange,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();

  const visibleCategories =
    draft.clusterId === null
      ? options.categories
      : options.categories.filter(
          (category) => category.cluster_id === draft.clusterId,
        );

  const selectCluster = (clusterId: number | null) => {
    onChange(applyClusterSelection(draft, clusterId, options.categories));
  };

  const toggleCategory = (categoryId: number) => {
    onChange(toggleCategorySelection(draft, categoryId));
  };

  const resetFilters = () => {
    onChange({
      ...draft,
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    });
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["88%"]}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.extends.colors.background,
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
        />
      )}
    >
      <View className="flex-1">
        {/* Scrollable filter controls */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerClassName="px-5 pb-6"
          showsVerticalScrollIndicator={false}
        >
          {/* Sheet heading */}
          <View className="flex-row items-center justify-between border-b border-border-primary pb-4">
            <AppText weight="bold" className="text-xl text-text-primary">
              Filter places
            </AppText>

            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface"
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>

          {/* Cluster selection */}
          <View className="pt-5">
            <AppText weight="bold" className="text-base text-text-primary">
              Cluster
            </AppText>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {[{ id: null, name: "All" }, ...options.clusters].map(
                (cluster) => {
                  const isSelected = cluster.id === draft.clusterId;

                  return (
                    <Pressable
                      key={cluster.id ?? "all"}
                      onPress={() => selectCluster(cluster.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`min-h-11 cursor-pointer justify-center rounded-full border px-4 active:opacity-70 ${
                        isSelected
                          ? "border-brand bg-brand"
                          : "border-border-primary bg-surface"
                      }`}
                    >
                      <AppText
                        weight="semibold"
                        className={
                          isSelected ? "text-white" : "text-text-secondary"
                        }
                      >
                        {cluster.name}
                      </AppText>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>

          {/* Category multi-selection */}
          <View className="pt-6">
            <AppText weight="bold" className="text-base text-text-primary">
              Category
            </AppText>

            <View className="mt-2">
              {visibleCategories.map((category) => {
                const isSelected = draft.categoryIds.includes(category.id);

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    className="min-h-12 cursor-pointer flex-row items-center py-2 active:opacity-70"
                  >
                    <MaterialCommunityIcons
                      name={
                        isSelected
                          ? "checkbox-marked"
                          : "checkbox-blank-outline"
                      }
                      size={24}
                      color={
                        isSelected
                          ? theme.extends.colors.brand
                          : theme.extends.colors.text.tertiary
                      }
                    />

                    <AppText className="ml-3 text-sm text-text-primary">
                      {category.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Specialty single-selection */}
          <View className="pt-5">
            <AppText weight="bold" className="text-base text-text-primary">
              Specialty
            </AppText>

            <Pressable
              onPress={() =>
                onChange({
                  ...draft,
                  specialtyTagId: null,
                })
              }
              accessibilityRole="button"
              accessibilityState={{
                selected: draft.specialtyTagId === null,
              }}
              className="min-h-11 cursor-pointer justify-center self-start py-2 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className={
                  draft.specialtyTagId === null
                    ? "text-brand"
                    : "text-text-secondary"
                }
              >
                Any specialty
              </AppText>
            </Pressable>

            <View className="mt-1 flex-row flex-wrap">
              {options.specialty_tags.map((specialty) => {
                const isSelected = specialty.id === draft.specialtyTagId;

                return (
                  <SpecialtyTagChip
                    key={specialty.id}
                    tag={specialty}
                    mode="filter"
                    isSelected={isSelected}
                    showSelectionIndicator
                    onPress={() =>
                      onChange(toggleSpecialtySelection(draft, specialty.id))
                    }
                  />
                );
              })}
            </View>
          </View>
        </BottomSheetScrollView>

        {/* Fixed filter actions */}
        <View
          className="flex-row gap-3 border-t border-border-primary bg-background px-5 pt-4"
          style={{
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <Pressable
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            className="min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full border border-border-primary active:opacity-70"
          >
            <AppText weight="bold" className="text-text-primary">
              Reset
            </AppText>
          </Pressable>

          <Pressable
            onPress={onApply}
            accessibilityRole="button"
            accessibilityLabel="Show filtered results"
            className="min-h-12 flex-[2] cursor-pointer items-center justify-center rounded-full bg-brand active:opacity-80"
          >
            <AppText weight="bold" className="text-white">
              Show results
            </AppText>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
}
