import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";
import { GEM_ACCENT, GEM_FILL } from "@/shared/styles/hiddenGems";
import type { MapDiscoveryFilters } from "../types/mapDiscovery.types";

type QuickFilterKey = "hiddenGems" | "openNow";

type Props = {
  filters: MapDiscoveryFilters;
  filterCount: number;
  onSearch: () => void;
  onFilters: () => void;
  onToggleQuick: (key: QuickFilterKey) => void;
  onClear: () => void;
  disabled?: boolean;
  hideQuickFilters?: boolean;
  onHeaderLayout?: (bottom: number) => void;
};

const BRAND = theme.extends.colors.brand;

// Each quick filter owns its accent so Hidden Gems matches the map's gem color.
const QUICK_FILTERS = [
  {
    key: "hiddenGems",
    label: "Hidden Gems",
    icon: "diamond-stone",
    accent: GEM_ACCENT,
    border: GEM_FILL,
  },
  {
    key: "openNow",
    label: "Open Now",
    icon: "clock-outline",
    accent: BRAND,
    border: BRAND,
  },
] as const;

const CHIP_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const;

/** Combines independent search and taxonomy actions above compact quick filters. */
export default function MapSearchOverlay({
  filters,
  filterCount,
  onSearch,
  onFilters,
  onToggleQuick,
  onClear,
  disabled = false,
  hideQuickFilters = false,
  onHeaderLayout,
}: Props) {
  const insets = useSafeAreaInsets();
  const advancedFilterCount =
    filters.categoryIds.length +
    Number(filters.clusterId !== null) +
    Number(filters.specialtyTagId !== null);

  return (
    <View
      className="absolute left-0 right-0 top-0 px-screen-x"
      style={{ paddingTop: insets.top + 12 }}
      pointerEvents="box-none"
    >
      {/* Global registered-business search */}
      <View
        className="flex-row items-center overflow-hidden rounded-full border border-border-primary bg-surface"
        testID="map-search-header"
        style={shadows.floating}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          onHeaderLayout?.(y + height);
        }}
      >
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search SugboGo businesses"
          className="min-h-12 min-w-0 flex-1 flex-row items-center px-4 active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={theme.extends.colors.text.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <AppText
            className="ml-3 min-w-0 flex-1 text-sm text-text-secondary"
            numberOfLines={1}
          >
            Search SugboGo businesses
          </AppText>
        </Pressable>
        <View className="h-6 w-px bg-border-primary" />
        <Pressable
          onPress={onFilters}
          accessibilityRole="button"
          accessibilityLabel={`Map filters${advancedFilterCount ? `, ${advancedFilterCount} active` : ""}`}
          accessibilityState={{ selected: advancedFilterCount > 0 }}
          className={`h-12 w-12 items-center justify-center active:opacity-70 ${advancedFilterCount > 0 ? "bg-brand/10" : ""}`}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={21}
            color={
              advancedFilterCount > 0
                ? BRAND
                : theme.extends.colors.text.secondary
            }
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {/* Active-count badge instead of an unlabeled dot */}
          {advancedFilterCount > 0 && (
            <View
              className="absolute right-1.5 top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <AppText
                weight="bold"
                className="text-[10px] leading-3 text-white"
                style={{ includeFontPadding: false }}
              >
                {advancedFilterCount}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Quick filters collapse independently of the persistent search/filter bar. */}
      {!hideQuickFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Bleed to the screen edges so chips scroll under the gutter
          // instead of being clipped at the padding.
          className="-mx-screen-x mt-2 flex-none"
          contentContainerClassName="gap-2 px-screen-x py-1"
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_FILTERS.map((filter) => {
            const isActive = filters[filter.key];

            return (
              <Pressable
                key={filter.key}
                onPress={() => onToggleQuick(filter.key)}
                disabled={disabled}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={filter.label}
                accessibilityState={{ selected: isActive, disabled }}
                className={`min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-70 ${disabled ? "opacity-50" : ""}`}
                style={[
                  CHIP_SHADOW,
                  {
                    backgroundColor: isActive
                      ? filter.border
                      : theme.extends.colors.surface,
                    borderColor: isActive
                      ? filter.border
                      : theme.extends.colors.border.primary,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={filter.icon}
                  size={18}
                  color={
                    isActive ? theme.extends.colors.surface : filter.accent
                  }
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <AppText
                  weight="semibold"
                  className={`text-sm ${isActive ? "text-white" : "text-text-primary"}`}
                >
                  {filter.label}
                </AppText>
                {isActive && (
                  <MaterialCommunityIcons
                    name="check"
                    size={15}
                    color={theme.extends.colors.surface}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                )}
              </Pressable>
            );
          })}

          {filterCount > 0 && (
            <Pressable
              onPress={onClear}
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${filterCount} map ${filterCount === 1 ? "filter" : "filters"}`}
              accessibilityState={{ disabled }}
              className={`min-h-10 flex-row items-center gap-1 rounded-full bg-surface px-3.5 active:opacity-70 ${disabled ? "opacity-50" : ""}`}
              style={CHIP_SHADOW}
            >
              <MaterialCommunityIcons
                name="close"
                size={16}
                color={theme.extends.colors.text.secondary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <AppText
                weight="semibold"
                className="text-sm text-text-secondary"
              >
                Clear
              </AppText>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
