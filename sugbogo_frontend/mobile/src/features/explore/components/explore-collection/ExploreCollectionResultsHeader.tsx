import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";

export type ExploreAppliedFilter = {
  id: string;
  label: string;
  onRemove: () => void;
};

type Props = {
  filters: ExploreAppliedFilter[];
  isLoading: boolean;
  totalItems: number;
};

/**
 * Displays committed collection filters and result metadata.
 *
 * Applied filter chips remain visible during filtered-query loading while the
 * result count temporarily switches to a skeleton placeholder.
 */
export default function ExploreCollectionResultsHeader({
  filters,
  isLoading,
  totalItems,
}: Props) {
  return (
    <View>
      {/* Applied taxonomy filters */}
      {filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 py-3"
        >
          {filters.map((filter) => (
            <SafePressable
              key={filter.id}
              onPress={filter.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${filter.label} filter`}
              className="min-h-10 cursor-pointer flex-row items-center rounded-full border border-border-primary bg-surface px-3 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                {filter.label}
              </AppText>

              <MaterialCommunityIcons
                name="close"
                size={16}
                color={theme.extends.colors.text.secondary}
                style={{ marginLeft: 5 }}
              />
            </SafePressable>
          ))}
        </ScrollView>
      )}

      {/* Result count */}
      <View className="px-4 pb-4 pt-3">
        {isLoading ? (
          <Skeleton className="h-4 w-20 rounded-md" />
        ) : (
          <AppText className="text-sm text-text-secondary">
            {totalItems} {totalItems === 1 ? "place" : "places"}
          </AppText>
        )}
      </View>
    </View>
  );
}
