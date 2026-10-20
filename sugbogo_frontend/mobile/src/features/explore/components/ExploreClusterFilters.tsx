import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ExploreFilterCluster } from "../types/exploreBusiness.types";

type Props = {
  clusters: ExploreFilterCluster[];
  selectedClusterId: number | null;
  onSelectCluster: (clusterId: number | null) => void;
  isLoading?: boolean;
  contentContainerClassName?: string;
};

/** Shares Explore's icon-based cluster choices across discovery and collection headers. */
export default function ExploreClusterFilters({
  clusters = [],
  selectedClusterId,
  onSelectCluster,
  isLoading = false,
  contentContainerClassName = "gap-2",
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-none"
      contentContainerClassName={contentContainerClassName}
    >
      {isLoading ? (
        <>
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </>
      ) : (
        [{ id: null, name: "All", icon: null }, ...clusters].map((cluster) => {
          const isActive = cluster.id === selectedClusterId;
          return (
            <SafePressable
              key={cluster.id ?? "all"}
              onPress={() => onSelectCluster(cluster.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className={`cursor-pointer flex-row items-center rounded-full px-4 py-2 active:opacity-70 ${isActive ? "bg-brand" : "bg-background"}`}
            >
              {cluster.icon && (
                <MaterialCommunityIcons
                  name={CLUSTER_ICONS[cluster.icon] ?? "store"}
                  size={14}
                  color={
                    isActive
                      ? theme.extends.colors.surface
                      : theme.extends.colors.text.secondary
                  }
                  style={{ marginRight: 5 }}
                />
              )}
              <AppText
                weight="medium"
                className={`text-sm ${isActive ? "text-white" : "text-text-secondary"}`}
              >
                {cluster.name}
              </AppText>
            </SafePressable>
          );
        })
      )}
    </ScrollView>
  );
}
