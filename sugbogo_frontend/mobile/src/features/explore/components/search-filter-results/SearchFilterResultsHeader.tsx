import { Pressable, ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

import type {
  ExploreFilterCategory,
  ExploreFilterCluster,
  ExploreFilterSpecialty,
} from "../../types/exploreBusiness.types";
import AppliedFilterChip from "../AppliedFilterChip";

type Props = {
  clusters: ExploreFilterCluster[];
  selectedClusterId: number | null;
  selectedCategories: ExploreFilterCategory[];
  selectedSpecialty: ExploreFilterSpecialty | undefined;
  totalItems: number;
  isLoading: boolean;
  onSelectCluster: (clusterId: number | null) => void;
  onRemoveCategory: (categoryId: number) => void;
  onRemoveSpecialty: () => void;
};

/**
 * Displays taxonomy controls and result metadata for search and filter results.
 *
 * Keeps committed filters visible while a new request loads and replaces only
 * the result count with a loading placeholder.
 */
export default function SearchFilterResultsHeader({
  clusters,
  selectedClusterId,
  selectedCategories,
  selectedSpecialty,
  totalItems,
  isLoading,
  onSelectCluster,
  onRemoveCategory,
  onRemoveSpecialty,
}: Props) {
  return (
    <View>
      {/* Cluster quick filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 py-3"
      >
        {[{ id: null, name: "All" }, ...clusters].map((cluster) => {
          const isSelected = cluster.id === selectedClusterId;

          return (
            <Pressable
              key={cluster.id ?? "all"}
              onPress={() => onSelectCluster(cluster.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`min-h-11 cursor-pointer justify-center rounded-full px-4 active:opacity-70 ${
                isSelected ? "bg-brand" : "bg-background"
              }`}
            >
              <AppText
                weight="semibold"
                className={isSelected ? "text-white" : "text-text-secondary"}
              >
                {cluster.name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Applied taxonomy filters */}
      {(selectedCategories.length > 0 || selectedSpecialty) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 pb-3"
        >
          {selectedCategories.map((category) => (
            <AppliedFilterChip
              key={category.id}
              label={category.name}
              onRemove={() => onRemoveCategory(category.id)}
            />
          ))}

          {selectedSpecialty && (
            <AppliedFilterChip
              label={selectedSpecialty.name}
              onRemove={onRemoveSpecialty}
            />
          )}
        </ScrollView>
      )}

      {/* Results summary */}
      <View className="px-4 pb-4 pt-1">
        {/* <AppText weight="bold" className="text-xl text-text-primary">
          Places
        </AppText> */}

        <View className="mt-1">
          {isLoading ? (
            <Skeleton className="h-4 w-20 rounded-md" />
          ) : (
            <AppText className="text-sm text-text-secondary">
              {totalItems} {totalItems === 1 ? "place" : "places"}
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}
