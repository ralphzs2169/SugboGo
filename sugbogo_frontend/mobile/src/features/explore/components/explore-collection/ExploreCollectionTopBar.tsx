import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  title: string;
  activeFilterCount: number;
  isFilterLoading: boolean;
  topInset: number;
  onBack: () => void;
  onOpenFilters: () => void;
};

/**
 * Displays the Explore collection navigation bar.
 *
 * Provides collection navigation and access to taxonomy filters while showing
 * the number of currently applied filters.
 */
export default function ExploreCollectionTopBar({
  title,
  activeFilterCount,
  isFilterLoading,
  topInset,
  onBack,
  onOpenFilters,
}: Props) {
  return (
    <View
      className="flex-row items-center gap-3 border-b border-border-primary bg-surface px-3 pb-3"
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

      {/* Collection title */}
      <AppText
        weight="bold"
        className="min-w-0 flex-1 text-md text-text-primary"
        numberOfLines={2}
      >
        {title}
      </AppText>

      {/* Filter control */}
      <SafePressable
        onPress={onOpenFilters}
        disabled={isFilterLoading}
        accessibilityRole="button"
        accessibilityLabel="Filter this collection"
        accessibilityState={{
          disabled: isFilterLoading,
        }}
        className="relative min-h-12 cursor-pointer flex-row items-center rounded-xl border border-border-primary bg-background px-3 active:opacity-70 disabled:opacity-50"
      >
        <MaterialCommunityIcons
          name="tune-variant"
          size={20}
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
