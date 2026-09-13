import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

const MASCOT_GREETING = require("@/shared/assets/mascot/mascot-greeting.webp");

type ClusterOption = {
  id: number;
  name: string;
  icon: string;
};

type Props = {
  clusters: ClusterOption[];
  selectedClusterId: number | null;
  onSelectCluster: (clusterId: number | null) => void;
  onPressSearch: () => void;
  onPressFilters: () => void;
  activeFilterCount?: number;
  isLoadingClusters?: boolean;
};

/**
 * Displays the Explore homepage's primary discovery controls.
 *
 * Search acts as an entry point into the dedicated results experience, while
 * filters and Cluster shortcuts provide direct ways to refine discovery.
 */
export default function ExploreTopBar({
  clusters,
  selectedClusterId,
  onSelectCluster,
  onPressSearch,
  onPressFilters,
  activeFilterCount = 0,
  isLoadingClusters = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Exploration context */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-1">
          <AppText weight="superbold" className="text-2xl text-text-primary">
            Explore{" "}
            <AppText weight="superbold" className="text-2xl text-brand">
              Cebu
            </AppText>
          </AppText>

          <View className="mt-1 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={15}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="medium"
              className="ml-1 text-sm text-text-secondary"
            >
              Cebu City, Cebu
            </AppText>
          </View>
        </View>

        {/* Mascot branding */}
        <View className="ml-3 h-11 w-11 items-center justify-center">
          <Image
            source={MASCOT_GREETING}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Search and filtering */}
      <View className="mb-3 flex-row gap-2">
        <SafePressable
          onPress={onPressSearch}
          accessibilityRole="button"
          accessibilityLabel="Search businesses or places"
          className="cursor-pointer flex-1 flex-row items-center rounded-full border border-border-primary bg-background px-3.5 active:opacity-80"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={theme.extends.colors.text.tertiary}
          />

          <AppText className="ml-2 flex-1 py-3 text-sm text-text-tertiary">
            Search businesses or places...
          </AppText>
        </SafePressable>

        <SafePressable
          onPress={onPressFilters}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Open discovery filters"
          className="relative cursor-pointer items-center justify-center rounded-full border border-border-primary bg-background px-3.5 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={22}
            color={theme.extends.colors.text.secondary}
          />

          {activeFilterCount > 0 && (
            <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
              <AppText
                weight="bold"
                className="text-[10px] leading-4 text-white"
              >
                {activeFilterCount}
              </AppText>
            </View>
          )}
        </SafePressable>
      </View>

      {/* Quick discovery clusters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-none"
        contentContainerClassName="gap-2"
      >
        {isLoadingClusters ? (
          <>
            <Skeleton className="h-9 w-14 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </>
        ) : (
          [{ id: null, name: "All", icon: null }, ...clusters].map(
            (cluster) => {
              const isActive = cluster.id === selectedClusterId;

              return (
                <SafePressable
                  key={cluster.id ?? "all"}
                  onPress={() => onSelectCluster(cluster.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className={`cursor-pointer flex-row items-center rounded-full px-4 py-2 ${
                    isActive ? "bg-brand" : "bg-background"
                  }`}
                >
                  {cluster.icon && (
                    <MaterialCommunityIcons
                      name={CLUSTER_ICONS[cluster.icon] ?? "store"}
                      size={14}
                      color={
                        isActive
                          ? "#FFFFFF"
                          : theme.extends.colors.text.secondary
                      }
                      style={{ marginRight: 5 }}
                    />
                  )}

                  <AppText
                    weight="medium"
                    className={`text-sm ${
                      isActive ? "text-white" : "text-text-secondary"
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
    </View>
  );
}
