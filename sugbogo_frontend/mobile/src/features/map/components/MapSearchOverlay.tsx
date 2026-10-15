import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";
import type { MapDiscoveryFilters } from "../types/mapDiscovery.types";

type Props = {
  filters: MapDiscoveryFilters;
  filterCount: number;
  onSearch: () => void;
  onFilters: () => void;
  onToggleQuick: (key: "hiddenGems" | "openNow") => void;
  onClear: () => void;
  disabled?: boolean;
  hideQuickFilters?: boolean;
};

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
        style={shadows.floating}
      >
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search SugboGo businesses"
          className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center px-4 active:bg-surface-secondary"
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
          className="h-12 w-12 cursor-pointer items-center justify-center active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={21}
            color={
              advancedFilterCount > 0
                ? theme.extends.colors.brand
                : theme.extends.colors.text.primary
            }
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {advancedFilterCount > 0 && (
            <View
              className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          )}
        </Pressable>
      </View>

      {/* Quick filters collapse independently of the persistent search/filter bar. */}
      {!hideQuickFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2 flex-none"
          contentContainerClassName="gap-2"
        >
          {(
            [
              {
                key: "hiddenGems",
                label: "Hidden Gems",
                icon: "diamond-stone",
              },
              { key: "openNow", label: "Open Now", icon: "clock-outline" },
            ] as const
          ).map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => onToggleQuick(filter.key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={filter.label}
              accessibilityState={{ selected: filters[filter.key], disabled }}
              className={`min-h-12 cursor-pointer flex-row items-center gap-2 rounded-full border px-4 active:opacity-70 ${filters[filter.key] ? "border-brand bg-surface" : "border-border-primary bg-surface"} ${disabled ? "opacity-50" : ""}`}
            >
              <MaterialCommunityIcons
                name={filters[filter.key] ? "check-circle" : filter.icon}
                size={18}
                color={theme.extends.colors.brand}
              />
              <AppText weight="semibold" className="text-sm text-text-primary">
                {filter.label}
              </AppText>
            </Pressable>
          ))}
          {filterCount > 0 && (
            <Pressable
              onPress={onClear}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Clear map filters"
              accessibilityState={{ disabled }}
              className="min-h-12 cursor-pointer justify-center rounded-full bg-surface px-4 active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-text-primary">
                Clear
              </AppText>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
