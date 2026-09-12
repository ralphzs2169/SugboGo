import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TextInput, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  search: string;
  autoFocus: boolean;
  activeFilterCount: number;
  isFilterLoading: boolean;
  topInset: number;
  onSearchChange: (value: string) => void;
  onBack: () => void;
  onOpenFilters: () => void;
};

/**
 * Displays the Explore results navigation, search, and filter controls.
 *
 * Keeps search editing and filtering available independently of the results
 * loading state while preserving the current committed filter count.
 */
export default function ExploreResultsTopBar({
  search,
  autoFocus,
  activeFilterCount,
  isFilterLoading,
  topInset,
  onSearchChange,
  onBack,
  onOpenFilters,
}: Props) {
  return (
    <View
      className="flex-row items-center gap-2 border-b border-border-primary bg-surface px-3 pb-3"
      style={{ paddingTop: topInset + 8 }}
    >
      {/* Back navigation */}
      <SafePressable
        onPress={onBack}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Back to Explore"
        className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-background"
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={24}
          color={theme.extends.colors.text.primary}
        />
      </SafePressable>

      {/* Search input */}
      <View className="h-12 min-w-0 flex-1 flex-row items-center rounded-full border border-border-primary bg-background px-3">
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={theme.extends.colors.text.tertiary}
        />

        <TextInput
          value={search}
          onChangeText={onSearchChange}
          autoFocus={autoFocus}
          className="ml-2 min-w-0 flex-1 text-sm text-text-primary"
          style={{
            fontFamily: "NunitoSans_400Regular",
          }}
          placeholder="Search businesses or places..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
          returnKeyType="search"
          accessibilityLabel="Search businesses or places"
        />

        {search.length > 0 && (
          <SafePressable
            onPress={() => onSearchChange("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            className="h-10 w-10 cursor-pointer items-center justify-center"
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={19}
              color={theme.extends.colors.text.tertiary}
            />
          </SafePressable>
        )}
      </View>

      {/* Filter control */}
      <SafePressable
        onPress={onOpenFilters}
        disabled={isFilterLoading}
        accessibilityRole="button"
        accessibilityLabel="Open discovery filters"
        accessibilityState={{
          disabled: isFilterLoading,
        }}
        className="relative h-12 w-12 cursor-pointer items-center justify-center rounded-input border border-border-primary bg-background active:opacity-70 disabled:opacity-50"
      >
        <MaterialCommunityIcons
          name="tune-variant"
          size={22}
          color={theme.extends.colors.text.secondary}
        />

        {activeFilterCount > 0 && (
          <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
            <AppText weight="bold" className="text-[10px] text-white">
              {activeFilterCount}
            </AppText>
          </View>
        )}
      </SafePressable>
    </View>
  );
}
