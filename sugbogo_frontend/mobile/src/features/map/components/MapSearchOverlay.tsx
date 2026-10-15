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
};

/** Keeps global search distinct from compact controls for the visible map area. */
export default function MapSearchOverlay({
  filters,
  filterCount,
  onSearch,
  onFilters,
  onToggleQuick,
  onClear,
  disabled = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-0 right-0 top-0 px-screen-x"
      style={{ paddingTop: insets.top + 12 }}
      pointerEvents="box-none"
    >
      {/* Global registered-business search */}
      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel="Search SugboGo businesses"
        className="min-h-12 cursor-pointer flex-row items-center rounded-full border border-border-primary bg-surface px-4 active:opacity-80"
        style={shadows.floating}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={21}
          color={theme.extends.colors.text.secondary}
        />
        <AppText className="ml-3 flex-1 text-sm text-text-secondary">
          Search SugboGo businesses
        </AppText>
      </Pressable>

      {/* These controls filter the visible area; location remains a separate control. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2 flex-none"
        contentContainerClassName="gap-2"
      >
        <Pressable
          onPress={onFilters}
          accessibilityRole="button"
          accessibilityLabel={`Map filters${filterCount ? `, ${filterCount} active` : ""}`}
          accessibilityState={{ selected: filterCount > 0 }}
          className="min-h-12 cursor-pointer flex-row items-center gap-2 rounded-full border border-border-primary bg-surface px-4 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={theme.extends.colors.text.primary}
          />
          <AppText weight="semibold" className="text-sm text-text-primary">
            Filters{filterCount ? ` (${filterCount})` : ""}
          </AppText>
        </Pressable>
        {(
          [
            { key: "hiddenGems", label: "Hidden Gems", icon: "diamond-stone" },
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
    </View>
  );
}
