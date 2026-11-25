import { View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Skeleton from "@/shared/components/Skeleton";
import { shadows } from "@/shared/styles/shadows";

/** Match compact journey cards using the existing business-card shimmer. */
export function JourneyCardsSkeleton() {
  return (
    <View
      testID="journey-cards-loading"
      accessibilityRole="progressbar"
      accessibilityLabel="Finding journeys"
    >
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          className="mb-3 rounded-3xl border border-border-primary bg-surface p-4"
        >
          <View className="mb-3 items-end">
            <Skeleton className="h-3 w-20 rounded-md" />
          </View>
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-9 w-14 rounded-xl" />
            <Skeleton className="h-9 w-14 rounded-xl" />
            <View className="ml-auto">
              <Skeleton className="h-4 w-20 rounded-md" />
            </View>
          </View>
          <Skeleton className="mt-3 h-3 w-40 rounded-md" />
        </View>
      ))}
    </View>
  );
}

/** Follow the road-route screen's edge-to-edge map and floating-context skeleton. */
export function JourneyMapSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["bottom"]}
      className="flex-1 bg-background"
      testID="journey-map-loading"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading journey map"
    >
      <View className="flex-1 overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />
        <View
          className="absolute left-0 right-0 px-screen-x"
          style={{ top: insets.top + 12 }}
        >
          <View
            className="flex-row items-center rounded-2xl border border-border-primary bg-surface px-3 py-3"
            style={shadows.floating}
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="ml-1.5 h-11 w-11 rounded-lg" />
            <View className="ml-2 flex-1">
              <Skeleton className="h-2.5 w-14 rounded-full" />
              <Skeleton className="mt-2 h-5 w-2/3 rounded-full" />
            </View>
          </View>
        </View>
      </View>
      <View
        className="rounded-t-3xl border-t border-border-primary bg-surface px-5 pb-6 pt-3"
        style={shadows.docked}
      >
        <View className="mb-4 items-center">
          <Skeleton className="h-1 w-10 rounded-full" />
        </View>
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <View className="flex-1">
            <Skeleton className="h-3 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-32 rounded-md" />
          </View>
        </View>
        <Skeleton className="mt-4 h-3 w-44 rounded-md" />
      </View>
    </SafeAreaView>
  );
}
