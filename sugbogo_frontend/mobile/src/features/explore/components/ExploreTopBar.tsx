import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import AppText from "@/shared/components/AppText";
import Avatar from "@/shared/components/Avatar";
import SafePressable from "@/shared/components/SafePressable";
import ExploreClusterFilters from "./ExploreClusterFilters";

type ClusterOption = { id: number; name: string; icon: string };

type Props = {
  clusters: ClusterOption[];
  selectedClusterId: number | null;
  onSelectCluster: (clusterId: number | null) => void;
  isLoadingClusters?: boolean;
  onPressSearch: () => void;
  onPressFilters: () => void;
  activeFilterCount?: number;
};

/**
 * Displays the Explore homepage's primary discovery controls.
 *
 * Search acts as an entry point into the dedicated results experience, while
 * filters provide direct ways to refine discovery.
 */
export default function ExploreTopBar({
  clusters = [],
  selectedClusterId,
  onSelectCluster,
  isLoadingClusters = false,
  onPressSearch,
  onPressFilters,
  activeFilterCount = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSession = isAuthenticated && Boolean(user);

  return (
    <View
      className="bg-surface px-4 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Exploration context */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="min-w-0 flex-1">
          <AppText weight="superbold" className="text-2xl text-text-primary">
            Sugbo
            <AppText weight="superbold" className="text-2xl text-brand">
              Go
            </AppText>
          </AppText>
        </View>

        {/* Header actions */}
        <View className="ml-2 flex-row items-center">
          <NotificationBellButton />
          <SafePressable
            accessibilityRole="button"
            accessibilityLabel={hasSession ? "Open your profile" : "Sign in"}
            onPress={() =>
              router.navigate(
                hasSession ? "/(explorer)/(tabs)/profile" : "/(auth)/login",
              )
            }
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:opacity-75"
          >
            {hasSession ? (
              <Avatar
                imageUrl={user?.avatar_url}
                avatarKey={user?.avatar_key}
                size={36}
              />
            ) : (
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={36}
                color={theme.extends.colors.text.secondary}
              />
            )}
          </SafePressable>
        </View>
      </View>

      {/* Search and filtering */}
      <View className="mb-3 flex-row gap-2">
        <SafePressable
          onPress={onPressSearch}
          accessibilityRole="button"
          accessibilityLabel="Search businesses or places"
          className="min-h-12 cursor-pointer flex-1 flex-row items-center rounded-full border border-border-primary bg-background px-3.5 active:opacity-80"
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
          className="relative min-h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-background active:opacity-70"
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
      <ExploreClusterFilters
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        onSelectCluster={onSelectCluster}
        isLoading={isLoadingClusters}
      />
    </View>
  );
}
