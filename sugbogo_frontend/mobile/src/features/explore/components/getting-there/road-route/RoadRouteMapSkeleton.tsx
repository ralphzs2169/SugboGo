import { View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  message: string;
};

/**
 * Displays the loading state for the road-route map.
 *
 * Mirrors the final map-first layout with a full-screen map placeholder,
 * floating destination context, and persistent road-route guidance footer.
 */
export default function RoadRouteMapSkeleton({ message }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["bottom"]}
      className="flex-1 bg-background"
      accessibilityLabel={message}
      accessibilityRole="progressbar"
    >
      {/* Map area */}
      <View className="flex-1 overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />

        {/* Floating destination context */}
        <View
          className="absolute left-0 right-0 px-screen-x"
          style={{
            top: insets.top + 12,
          }}
        >
          <View
            className="rounded-2xl border border-border-primary bg-surface"
            style={shadows.floating}
          >
            <View className="flex-row items-center px-2.5 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />

              <Skeleton className="ml-1.5 h-[34px] w-[34px] rounded-lg" />

              <View className="ml-2 min-w-0 flex-1">
                <Skeleton className="h-2.5 w-14 rounded-full" />
                <Skeleton className="mt-1.5 h-4 w-2/3 rounded-full" />
              </View>
            </View>
          </View>
        </View>

        {/* Loading status */}
        <View className="absolute inset-x-0 top-1/2 items-center">
          <View className="rounded-full bg-surface px-3 py-2">
            <AppText className="text-xs text-text-secondary">{message}</AppText>
          </View>
        </View>
      </View>

      {/* Persistent road-route guidance */}
      <View
        className="rounded-t-[28px] border-t border-border-primary bg-surface px-screen-x pb-3 pt-4"
        style={shadows.docked}
      >
        {/* Route metrics */}
        <View className="flex-row items-center">
          <View className="min-w-0 flex-1 flex-row items-center">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

            <View className="ml-3 min-w-0 flex-1">
              <Skeleton className="h-2.5 w-14 rounded-full" />
              <Skeleton className="mt-2 h-5 w-16 rounded-full" />
            </View>
          </View>

          <View className="mx-3 h-9 w-px bg-border-primary" />

          <View className="min-w-0 flex-1 flex-row items-center">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

            <View className="ml-3 min-w-0 flex-1">
              <Skeleton className="h-2.5 w-20 rounded-full" />
              <Skeleton className="mt-2 h-5 w-14 rounded-full" />
            </View>
          </View>
        </View>

        {/* Traffic clarification */}
        <View className="mt-3 flex-row items-center">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="ml-2 h-3 w-52 rounded-full" />
        </View>

        {/* External navigation action */}
        <Skeleton className="mt-4 h-13 w-full rounded-full" />

        {/* Navigation context */}
        <View className="mt-2 flex-row items-center justify-center">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="ml-1.5 h-2.5 w-52 rounded-full" />
        </View>
      </View>
    </SafeAreaView>
  );
}
