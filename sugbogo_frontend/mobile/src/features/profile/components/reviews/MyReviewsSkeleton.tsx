import { View } from "react-native";
import Skeleton from "@/shared/components/Skeleton";

/** Reserves the business, status, and review layout during the first request. */
export default function MyReviewsSkeleton() {
  return (
    <View
      testID="my-reviews-skeleton"
      accessibilityLabel="Loading your reviews"
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2].map((item) => (
        <View key={item} className="mb-3 rounded-card bg-surface p-4">
          {/* Business identity */}
          <View className="flex-row items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </View>
          </View>
          {/* Date, status, and content */}
          <Skeleton className="mt-4 h-5 w-48 rounded-full" />
          <Skeleton className="mt-4 h-4 w-full rounded" />
          <Skeleton className="mt-2 h-4 w-4/5 rounded" />
          <Skeleton className="mt-3 h-24 w-24 rounded-lg" />
        </View>
      ))}
    </View>
  );
}
