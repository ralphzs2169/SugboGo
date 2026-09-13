import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

const MAP_PREVIEW_HEIGHT = 210;

/**
 * Displays a map-preview placeholder for the Explore homepage.
 *
 * Mirrors the main map card regions so the loading state transitions smoothly
 * into the real preview without a large layout shift.
 */
export default function ExploreMapSkeleton() {
  return (
    <View className="mx-4 overflow-hidden rounded-card border border-border-primary bg-surface">
      {/* Map preview placeholder */}
      <View
        style={{ height: MAP_PREVIEW_HEIGHT }}
        className="relative overflow-hidden bg-surface-secondary"
      >
        <Skeleton className="h-full w-full rounded-none" />

        {/* Map context placeholder */}
        <View className="absolute left-3 top-3">
          <Skeleton className="h-8 w-24 rounded-full" />
        </View>
      </View>

      {/* Map action placeholder */}
      <View className="flex-row items-center justify-between px-4 py-3.5">
        <View className="min-w-0 flex-1">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="mt-2 h-3 w-56 max-w-full rounded-md" />
        </View>

        <View className="ml-4 flex-row items-center">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="ml-2 h-5 w-5 rounded-md" />
        </View>
      </View>
    </View>
  );
}
