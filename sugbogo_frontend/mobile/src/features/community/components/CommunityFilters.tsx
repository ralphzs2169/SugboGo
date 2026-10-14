import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import type { ExploreFilterCluster } from "@/features/explore/types/exploreBusiness.types";
import type {
  CommunityReviewFilters,
  CommunityReviewOrdering,
} from "../types/communityReview.types";

const SORT_OPTIONS: {
  label: string;
  value: CommunityReviewOrdering;
}[] = [
  { label: "Newest", value: "newest" },
  { label: "Most Helpful", value: "most_helpful" },
];

type Props = {
  clusters: ExploreFilterCluster[];
  isLoadingClusters: boolean;
  hasClusterError: boolean;
  filters: CommunityReviewFilters;
  onChange: Dispatch<SetStateAction<CommunityReviewFilters>>;
  onRetryClusters: () => void;
};

/**
 * Displays compact server-backed Community filters.
 *
 * Cluster selection, photo filtering, and sorting update immediately
 * while preserving the existing query-driven feed behavior.
 */
export default function CommunityFilters({
  clusters,
  isLoadingClusters,
  hasClusterError,
  filters,
  onChange,
  onRetryClusters,
}: Props) {
  return (
    <View className="border-b border-border-primary bg-surface pb-3 pt-1">
      {/* Cluster navigation */}
      <ScrollView
        testID="community-cluster-filters"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="min-h-11 items-center gap-2 px-4"
      >
        {isLoadingClusters ? (
          <>
            <Skeleton className="h-9 w-14 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </>
        ) : (
          [{ id: null, name: "All", icon: null }, ...clusters].map(
            (cluster) => {
              const selected = filters.clusterId === cluster.id;

              return (
                <SafePressable
                  key={cluster.id ?? "all"}
                  onPress={() =>
                    onChange((current) =>
                      current.clusterId === cluster.id
                        ? current
                        : { ...current, clusterId: cluster.id },
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${cluster.name} Community reviews`}
                  accessibilityState={{ selected }}
                  className={`min-h-11 cursor-pointer flex-row items-center rounded-full px-3.5 active:opacity-80 ${
                    selected ? "bg-brand" : "bg-background"
                  }`}
                >
                  {cluster.icon && (
                    <MaterialCommunityIcons
                      name={CLUSTER_ICONS[cluster.icon] ?? "store"}
                      size={15}
                      color={
                        selected
                          ? theme.extends.colors.text.primary
                          : theme.extends.colors.text.secondary
                      }
                      style={{ marginRight: 6 }}
                    />
                  )}

                  <AppText
                    weight={selected ? "semibold" : "medium"}
                    className={`text-sm ${
                      selected ? "text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {cluster.name}
                  </AppText>
                </SafePressable>
              );
            },
          )
        )}
      </ScrollView>

      {/* Cluster retrieval error */}
      {hasClusterError && (
        <View className="mt-1 flex-row items-center justify-between px-4">
          <AppText className="text-xs text-text-secondary">
            Couldn't load all categories.
          </AppText>

          <Pressable
            onPress={onRetryClusters}
            accessibilityRole="button"
            accessibilityLabel="Retry loading Community categories"
            hitSlop={8}
            className="cursor-pointer min-h-11 flex-row items-center active:opacity-70"
          >
            <MaterialCommunityIcons
              name="refresh"
              size={15}
              color={theme.extends.colors.brand}
            />
            <AppText
              weight="semibold"
              className="ml-1 text-xs text-text-primary"
            >
              Retry
            </AppText>
          </Pressable>
        </View>
      )}

      {/* Content and sorting controls */}
      <ScrollView
        testID="community-feed-filters"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="min-h-11 items-center gap-2 px-4 pt-2"
      >
        {SORT_OPTIONS.map((option) => {
          const selected = filters.ordering === option.value;

          return (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={selected}
              showSelectedCheck
              onPress={() =>
                onChange((current) =>
                  current.ordering === option.value
                    ? current
                    : { ...current, ordering: option.value },
                )
              }
              accessibilityLabel={`Sort Community reviews by ${
                option.label
              }${selected ? ", selected" : ""}`}
            />
          );
        })}

        <View className="mx-1 h-5 w-px bg-border-primary" />

        <FilterChip
          label="With Photos"
          icon="image-outline"
          selected={filters.hasPhotos}
          showSelectedCheck
          onPress={() =>
            onChange((current) => ({
              ...current,
              hasPhotos: !current.hasPhotos,
            }))
          }
          accessibilityLabel={`With Photos${
            filters.hasPhotos ? ", selected" : ""
          }`}
        />
      </ScrollView>
    </View>
  );
}
