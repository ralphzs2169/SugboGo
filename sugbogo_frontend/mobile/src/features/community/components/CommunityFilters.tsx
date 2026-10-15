import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { CommunityReviewFilters } from "../types/communityReview.types";

type Props = {
  filters: CommunityReviewFilters;
  onPress: () => void;
};

/** Opens the staged Community filter and sort controls. */
export default function CommunityFilters({ filters, onPress }: Props) {
  const activeCount =
    (filters.clusterId !== null ? 1 : 0) +
    filters.categoryIds.length +
    (filters.specialtyTagId !== null ? 1 : 0) +
    (filters.hasPhotos ? 1 : 0) +
    (filters.ordering !== "newest" ? 1 : 0);

  return (
    <View className="flex-row items-center justify-between border-b border-border-primary bg-surface px-4 py-2">
      <AppText weight="bold" className="text-base text-text-primary">
        Explorer reviews
      </AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Filter and sort Community reviews${activeCount ? `, ${activeCount} active` : ""}`}
        className="min-h-11 flex-row items-center rounded-full px-3 active:bg-surface-muted"
      >
        <MaterialCommunityIcons
          name="tune-variant"
          size={18}
          color={theme.extends.colors.text.primary}
        />
        <AppText weight="semibold" className="ml-2 text-sm text-text-primary">
          Filter & sort
        </AppText>
        {activeCount > 0 && (
          <View className="ml-2 min-w-5 items-center rounded-full bg-surface-muted-strong px-1.5 py-0.5">
            <AppText weight="bold" className="text-xs text-text-primary">
              {activeCount}
            </AppText>
          </View>
        )}
      </Pressable>
    </View>
  );
}
