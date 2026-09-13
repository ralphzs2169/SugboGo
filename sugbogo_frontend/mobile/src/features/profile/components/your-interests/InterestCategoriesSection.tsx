import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ClusterIcon } from "@/shared/types/cluster.types";
import type { InterestCategory } from "@/features/profile/types/interest.types";

export type InterestCategoryGroup = {
  clusterName: string;
  clusterIcon: ClusterIcon;
  categories: InterestCategory[];
};

type InterestCategoriesSectionProps = {
  categoryGroups: [number, InterestCategoryGroup][];
  selectedCategoryIds: number[];
  onToggleCategory: (categoryId: number) => void;
};

/**
 * Renders grouped category choices with cluster context and reports selection
 * changes back to the parent screen.
 */
export default function InterestCategoriesSection({
  categoryGroups,
  selectedCategoryIds,
  onToggleCategory,
}: InterestCategoriesSectionProps) {
  return (
    <View className="gap-3">
      {/* Category groups */}
      {categoryGroups.map(([clusterId, group]) => {
        const clusterIconName = CLUSTER_ICONS[group.clusterIcon] ?? "store";

        return (
          <View
            key={clusterId}
            className="rounded-xl border border-border-primary bg-surface px-4 py-4"
          >
            {/* Cluster heading */}
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name={clusterIconName}
                size={17}
                color={theme.extends.colors.text.secondary}
              />

              <AppText
                weight="semibold"
                className="ml-2 text-sm text-text-primary"
              >
                {group.clusterName}
              </AppText>
            </View>

            {/* Category choices */}
            <View className="mt-3 flex-row flex-wrap">
              {group.categories.map((category) => {
                const isSelected = selectedCategoryIds.includes(category.id);

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => onToggleCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityLabel={category.name}
                    accessibilityState={{ selected: isSelected }}
                    className={`mb-2 mr-2 min-h-10 cursor-pointer flex-row items-center justify-center rounded-lg  px-3.5 py-2 active:opacity-70 ${
                      isSelected
                        ? " bg-brand/80 "
                        : "border border-border-primary bg-background"
                    }`}
                  >
                    <AppText
                      weight="semibold"
                      className={
                        isSelected
                          ? "text-sm text-white"
                          : "text-sm text-text-secondary"
                      }
                    >
                      {category.name}
                    </AppText>

                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={15}
                        color="white"
                        style={{ marginLeft: 5 }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
