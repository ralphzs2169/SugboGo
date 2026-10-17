import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { CommunityReviewFilters } from "../types/communityReview.types";

type Props = {
  filters: CommunityReviewFilters;
  hasContentFilters: boolean;
  onOpenFilters: () => void;
  onTogglePhotos: () => void;
  onToggleMostHelpful: () => void;
  onClear: () => void;
};

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  count?: number;
  accessibilityLabel?: string;
  onPress: () => void;
};

function Chip({
  label,
  selected = false,
  icon,
  count = 0,
  accessibilityLabel,
  onPress,
}: ChipProps) {
  const foreground = selected ? "#fff" : theme.extends.colors.text.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={6}
      className={`h-9 flex-row items-center rounded-full border px-3 active:opacity-70 ${
        selected ? "border-brand bg-brand" : "border-border-primary bg-surface"
      }`}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={foreground}
          style={{ marginRight: 6 }}
        />
      )}
      <AppText
        weight="semibold"
        className={`text-sm ${selected ? "text-white" : "text-text-primary"}`}
      >
        {label}
      </AppText>
      {count > 0 && (
        <View className="ml-2 min-w-5 items-center rounded-full bg-brand px-1.5 py-0.5">
          <AppText weight="bold" className="text-xs text-white">
            {count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Quick controls under the Community title.
 *
 * Photos and "Most helpful" apply instantly; "Filters" opens the sheet for
 * cluster, category, and specialty choices. The badge counts only what the
 * other chips don't already show.
 */
export default function CommunityFilters({
  filters,
  hasContentFilters,
  onOpenFilters,
  onTogglePhotos,
  onToggleMostHelpful,
  onClear,
}: Props) {
  const sheetFilterCount =
    (filters.clusterId !== null ? 1 : 0) +
    filters.categoryIds.length +
    (filters.specialtyTagId !== null ? 1 : 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Chip
        label="Filters"
        icon="tune-variant"
        count={sheetFilterCount}
        accessibilityLabel={`Filters${
          sheetFilterCount ? `, ${sheetFilterCount} active` : ""
        }`}
        onPress={onOpenFilters}
      />
      <Chip
        label="With photos"
        icon="image-outline"
        selected={filters.hasPhotos}
        onPress={onTogglePhotos}
      />
      <Chip
        label="Most helpful"
        icon="thumb-up-outline"
        selected={filters.ordering === "most_helpful"}
        onPress={onToggleMostHelpful}
      />
      {hasContentFilters && (
        <Chip label="Clear" icon="close" onPress={onClear} />
      )}
    </ScrollView>
  );
}
