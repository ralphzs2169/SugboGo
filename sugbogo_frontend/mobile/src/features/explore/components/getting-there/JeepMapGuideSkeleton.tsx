import { View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  message: string;
};

/**
 * Displays the loading state for the Jeepney journey map.
 *
 * Mirrors the final route-map layout with an edge-to-edge map placeholder,
 * floating route context, and persistent stop-guidance footer.
 */
export default function JeepMapGuideSkeleton({ message }: Props) {
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

        {/* Floating route context */}
        <View
          className="absolute left-0 right-0 px-screen-x"
          style={{
            top: insets.top + 12,
          }}
        >
          <View className="overflow-hidden rounded-2xl border border-border-primary bg-surface">
            {/* Destination context */}
            <View className="flex-row items-center px-2.5 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />

              <Skeleton className="ml-1.5 h-[34px] w-[34px] rounded-lg" />

              <View className="ml-2 flex-1">
                <Skeleton className="h-2.5 w-14 rounded-full" />
                <Skeleton className="mt-1.5 h-4 w-2/3 rounded-full" />
              </View>
            </View>

            {/* Jeepney route summary */}
            <View className="flex-row items-center border-t border-border-primary bg-surface-secondary px-2.5 py-2">
              <Skeleton className="h-7 w-14 rounded-lg" />

              <View className="ml-2 flex-1">
                <Skeleton className="h-3 w-3/4 rounded-full" />
                <Skeleton className="mt-1.5 h-2.5 w-24 rounded-full" />
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

      {/* Stop-guidance footer */}
      <View className="rounded-t-3xl border-t border-border-primary bg-surface px-4 pb-3 pt-3.5">
        {/* Guidance heading */}
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="mt-2 h-3 w-36 rounded-full" />
          </View>

          <Skeleton className="h-8 w-8 rounded-full" />
        </View>

        {/* Boarding stop */}
        <View className="flex-row items-start">
          <View className="items-center">
            <Skeleton className="h-9 w-9 rounded-full" />

            <View className="my-1 h-6 items-center justify-between">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-1 w-1 rounded-full" />
              ))}
            </View>
          </View>

          <View className="ml-3 flex-1 pb-1">
            <View className="flex-row items-center justify-between">
              <Skeleton className="h-2.5 w-10 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </View>

            <Skeleton className="mt-2 h-4 w-3/4 rounded-full" />
          </View>
        </View>

        {/* Alighting stop */}
        <View className="flex-row items-start">
          <Skeleton className="h-9 w-9 rounded-full" />

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Skeleton className="h-2.5 w-12 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </View>

            <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
            <Skeleton className="mt-2 h-3 w-32 rounded-full" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
