import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Displays full-width review placeholders while private history loads.
 *
 * Matches the business identity, status, date, content, and separator layout
 * of the My Reviews list to reduce visual shifting after data arrives.
 */
export default function MyReviewsSkeleton() {
  return (
    <View
      testID="my-reviews-skeleton"
      accessibilityLabel="Loading your reviews"
      accessibilityState={{ busy: true }}
      className="bg-surface"
    >
      {[0, 1, 2].map((item, index) => (
        <View key={item}>
          <View className="px-4 py-4">
            {/* Business identity and actions */}
            <View className="min-h-14 flex-row items-center">
              <Skeleton className="h-12 w-12 rounded-lg" />

              <View className="ml-3 flex-1 gap-2">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </View>

              <Skeleton className="h-8 w-8 rounded-full" />
            </View>

            {/* Publication status and submission date */}
            <View className="mt-3 flex-row items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded" />
            </View>

            {/* Review text and attached media */}
            <View className="mt-4">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="mt-2 h-4 w-4/5 rounded" />
              <Skeleton className="mt-2 h-4 w-3/5 rounded" />

              <Skeleton className="mt-4 h-24 w-24 rounded-lg" />
            </View>
          </View>

          {/* Row separator */}
          {index < 2 && <View className="mx-4 h-px bg-border-primary" />}
        </View>
      ))}
    </View>
  );
}
