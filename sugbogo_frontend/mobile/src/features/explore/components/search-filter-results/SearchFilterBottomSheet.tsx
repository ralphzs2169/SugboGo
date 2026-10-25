import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import TaxonomyFilterControls from "@/shared/components/filters/TaxonomyFilterControls";
import { TAXONOMY_SEARCH_THRESHOLD } from "@/shared/utils/taxonomyFilters";
import ExploreFilterOptionsFeedback from "../ExploreFilterOptionsFeedback";
import type useExploreFilterOptions from "../../hooks/useExploreFilterOptions";

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
  onDismiss?: () => void;
  /**
   * Number of places matching the current draft. Provide it (debounced) from
   * the parent to get a live "Show 24 places" label. Omit to fall back to a
   * static "Show results" label.
   */
  resultCount?: number | null;
  /** True while `resultCount` is being refreshed for the latest draft. */
  isCountLoading?: boolean;
  taxonomyState?: ReturnType<typeof useExploreFilterOptions>;
};

const SNAP_POINTS = ["88%"];

/* -------------------------------------------------------------------------- */
/* Feedback helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Animates the next layout change (list growing/shrinking, chips moving). */
const animateLayout = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

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
  onDismiss,
  resultCount,
  isCountLoading = false,
  taxonomyState,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const showSearch =
    options.categories.length + options.specialty_tags.length >
    TAXONOMY_SEARCH_THRESHOLD;

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
    (specialtyId: number | null) => {
      onChange(
        specialtyId === null
          ? { ...draft, specialtyTagId: null }
          : toggleSpecialtySelection(draft, specialtyId),
      );
    },
    [draft, onChange],
  );

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
  const cannotApply =
    hasNoResults || Boolean(taxonomyState && !taxonomyState.hasOptions);

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
      onDismiss={() => {
        setQuery("");
        onDismiss?.();
      }}
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

          {/* Shared controls keep the feature's draft selection rules. */}
          {taxonomyState && (
            <ExploreFilterOptionsFeedback state={taxonomyState} />
          )}
          {(!taxonomyState || taxonomyState.hasOptions) && (
            <TaxonomyFilterControls
              options={options}
              clusterId={draft.clusterId}
              categoryIds={draft.categoryIds}
              specialtyTagId={draft.specialtyTagId}
              query={showSearch ? query : ""}
              onQueryChange={changeQuery}
              onClusterSelect={selectCluster}
              onCategoryToggle={toggleCategory}
              onSpecialtySelect={selectSpecialty}
            />
          )}
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
            disabled={cannotApply}
            accessibilityRole="button"
            accessibilityLabel={applyLabel}
            accessibilityState={{
              disabled: cannotApply,
              busy: isCountLoading,
            }}
            className={`min-h-12 flex-[2] flex-row items-center justify-center gap-2 rounded-full bg-brand active:opacity-80 ${
              cannotApply ? "opacity-40" : ""
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
