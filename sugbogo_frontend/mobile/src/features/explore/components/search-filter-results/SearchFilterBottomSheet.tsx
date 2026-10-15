import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
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
  /**
   * Number of places matching the current draft. Provide it (debounced) from
   * the parent to get a live "Show 24 places" label. Omit to fall back to a
   * static "Show results" label.
   */
  resultCount?: number | null;
  /** True while `resultCount` is being refreshed for the latest draft. */
  isCountLoading?: boolean;
};

type ClusterOption = { id: number | null; name: string };

const SNAP_POINTS = ["88%"];
const ALL_CLUSTERS: ClusterOption = { id: null, name: "All" };

/** The search field only appears once there is enough to search through. */
const SEARCH_THRESHOLD = 12;

/* -------------------------------------------------------------------------- */
/* Feedback helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Animates the next layout change (list growing/shrinking, chips moving). */
const animateLayout = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

/** Section wrapper with an accessible heading and optional trailing hint. */
function FilterSection({
  title,
  hint,
  className = "pt-6",
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={className}>
      <View className="flex-row items-baseline justify-between">
        <AppText
          weight="bold"
          accessibilityRole="header"
          className="text-base text-text-primary"
        >
          {title}
        </AppText>
        {hint ? (
          <AppText className="text-xs text-text-tertiary">{hint}</AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Draft taxonomy filters for Explore results.
 *
 * - Clusters scroll horizontally; categories wrap as multi-select chips.
 * - A search field narrows categories and specialties when lists are long.
 * - Header shows the active-filter count and a "Clear all" shortcut.
 * - Apply shows a live result count when the parent supplies one.
 * - Cluster changes, search, and reset animate the layout shift.
 * - Controls scroll while the actions stay pinned above the bottom inset.
 */
export default function ExploreFiltersSheet({
  sheetRef,
  options,
  draft,
  onChange,
  onApply,
  resultCount,
  isCountLoading = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const clusterOptions = useMemo<ClusterOption[]>(
    () => [ALL_CLUSTERS, ...options.clusters],
    [options.clusters],
  );

  const showSearch =
    options.categories.length + options.specialty_tags.length >
    SEARCH_THRESHOLD;

  const normalizedQuery = showSearch ? query.trim().toLowerCase() : "";

  const visibleCategories = useMemo(() => {
    const inCluster =
      draft.clusterId === null
        ? options.categories
        : options.categories.filter(
            (category) => category.cluster_id === draft.clusterId,
          );

    return normalizedQuery
      ? inCluster.filter((category) =>
          category.name.toLowerCase().includes(normalizedQuery),
        )
      : inCluster;
  }, [options.categories, draft.clusterId, normalizedQuery]);

  const visibleSpecialties = useMemo(
    () =>
      normalizedQuery
        ? options.specialty_tags.filter((specialty) =>
            specialty.name.toLowerCase().includes(normalizedQuery),
          )
        : options.specialty_tags,
    [options.specialty_tags, normalizedQuery],
  );

  const activeCount =
    (draft.clusterId !== null ? 1 : 0) +
    draft.categoryIds.length +
    (draft.specialtyTagId !== null ? 1 : 0);

  const hasActiveFilters = activeCount > 0;

  /* ------------------------------ Handlers -------------------------------- */

  const selectCluster = useCallback(
    (clusterId: number | null) => {
      animateLayout();
      onChange(applyClusterSelection(draft, clusterId, options.categories));
    },
    [draft, onChange, options.categories],
  );

  const toggleCategory = useCallback(
    (categoryId: number) => {
      onChange(toggleCategorySelection(draft, categoryId));
    },
    [draft, onChange],
  );

  const selectSpecialty = useCallback(
    (specialtyId: number) => {
      onChange(toggleSpecialtySelection(draft, specialtyId));
    },
    [draft, onChange],
  );

  const clearSpecialty = useCallback(() => {
    onChange({ ...draft, specialtyTagId: null });
  }, [draft, onChange]);

  const resetFilters = useCallback(() => {
    animateLayout();
    onChange({
      ...draft,
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    });
  }, [draft, onChange]);

  const changeQuery = useCallback((text: string) => {
    animateLayout();
    setQuery(text);
  }, []);

  const clearQuery = useCallback(() => {
    animateLayout();
    setQuery("");
  }, []);

  const closeSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const backgroundStyle = useMemo(
    () => ({
      backgroundColor: theme.extends.colors.surface,
      borderRadius: 24,
    }),
    [],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: theme.extends.colors.text.disabled,
      width: 40,
    }),
    [],
  );

  /* ---------------------------- Apply button ------------------------------ */

  const hasCount = typeof resultCount === "number" && !isCountLoading;
  const hasNoResults = hasCount && resultCount === 0;

  const applyLabel = hasCount
    ? hasNoResults
      ? "No places found"
      : `Show ${resultCount.toLocaleString()} ${
          resultCount === 1 ? "place" : "places"
        }`
    : "Show results";

  /* ------------------------------- Render --------------------------------- */

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleIndicatorStyle}
      backdropComponent={renderBackdrop}
      onDismiss={() => setQuery("")}
    >
      <View className="flex-1">
        {/* Scrollable filter controls */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerClassName="px-5 pb-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sheet heading */}
          <View className="flex-row items-center justify-between border-b border-border-primary pb-4">
            <View className="flex-row items-center gap-2">
              <AppText
                weight="bold"
                accessibilityRole="header"
                className="text-xl text-text-primary"
              >
                Filter places
              </AppText>

              {hasActiveFilters ? (
                <View
                  className="min-w-6 items-center rounded-full bg-brand px-2 py-0.5"
                  accessibilityLabel={`${activeCount} filters active`}
                >
                  <AppText weight="bold" className="text-xs text-white">
                    {activeCount}
                  </AppText>
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center">
              {hasActiveFilters ? (
                <Pressable
                  onPress={resetFilters}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                  className="min-h-11 justify-center px-2 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-brand">
                    Clear all
                  </AppText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={closeSheet}
                hitSlop={8}
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
          </View>

          {/* Search (only for long lists) */}
          {showSearch ? (
            <View className="mt-4 h-11 flex-row items-center rounded-full border border-border-primary bg-surface-muted px-4">
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={theme.extends.colors.text.tertiary}
              />
              <BottomSheetTextInput
                value={query}
                onChangeText={changeQuery}
                placeholder="Search categories and specialties"
                placeholderTextColor={theme.extends.colors.text.tertiary}
                returnKeyType="search"
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
              {query.length > 0 ? (
                <Pressable
                  onPress={clearQuery}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={theme.extends.colors.text.tertiary}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Cluster: single selection, horizontal scroll */}
          <FilterSection title="Cluster" className="pt-5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="radiogroup"
              className="-mx-5 mt-3"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {clusterOptions.map((cluster) => (
                <FilterChip
                  key={cluster.id ?? "all"}
                  label={cluster.name}
                  selected={cluster.id === draft.clusterId}
                  onPress={() => selectCluster(cluster.id)}
                />
              ))}
            </ScrollView>
          </FilterSection>

          {/* Category: multi selection, wrapping chips */}
          <FilterSection
            title="Category"
            hint={
              draft.categoryIds.length > 0
                ? `${draft.categoryIds.length} selected`
                : undefined
            }
          >
            {visibleCategories.length === 0 ? (
              <AppText className="mt-3 text-sm text-text-tertiary">
                {normalizedQuery
                  ? `No categories match “${query.trim()}”.`
                  : "No categories available."}
              </AppText>
            ) : (
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
            )}
          </FilterSection>

          {/* Specialty: single selection */}

          {/* Specialty: optional single selection */}
          <FilterSection title="Specialty" hint="Select one" className="pt-6">
            <Pressable
              onPress={clearSpecialty}
              accessibilityRole="radio"
              accessibilityState={{
                checked: draft.specialtyTagId === null,
              }}
              className="mt-2 min-h-10 cursor-pointer justify-center self-start active:opacity-70"
            ></Pressable>

            {visibleSpecialties.length === 0 ? (
              <AppText className="mt-2 text-sm text-text-tertiary">
                {normalizedQuery
                  ? `No specialties match “${query.trim()}”.`
                  : "No specialties available."}
              </AppText>
            ) : (
              <View className="mt-2 flex-row flex-wrap">
                {visibleSpecialties.map((specialty) => (
                  <SpecialtyTagChip
                    key={specialty.id}
                    tag={specialty}
                    mode="filter"
                    size="medium"
                    isSelected={specialty.id === draft.specialtyTagId}
                    showSelectionIndicator
                    onPress={() => selectSpecialty(specialty.id)}
                  />
                ))}
              </View>
            )}
          </FilterSection>
        </BottomSheetScrollView>

        {/* Fixed filter actions */}
        <View
          className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Pressable
            onPress={resetFilters}
            disabled={!hasActiveFilters}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            accessibilityState={{ disabled: !hasActiveFilters }}
            className={`min-h-12 flex-1 items-center justify-center rounded-full border border-border-primary active:opacity-70 ${
              hasActiveFilters ? "" : "opacity-40"
            }`}
          >
            <AppText weight="bold" className="text-text-primary">
              Reset
            </AppText>
          </Pressable>

          <Pressable
            onPress={onApply}
            disabled={hasNoResults}
            accessibilityRole="button"
            accessibilityLabel={applyLabel}
            accessibilityState={{
              disabled: hasNoResults,
              busy: isCountLoading,
            }}
            className={`min-h-12 flex-[2] flex-row items-center justify-center gap-2 rounded-full bg-brand active:opacity-80 ${
              hasNoResults ? "opacity-40" : ""
            }`}
          >
            {isCountLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : null}
            <AppText weight="bold" className="text-white">
              {applyLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
}
