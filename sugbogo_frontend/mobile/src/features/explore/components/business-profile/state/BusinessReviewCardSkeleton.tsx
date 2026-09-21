import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Displays a loading placeholder matching the business review card layout.
 *
 * Preserves the expected review structure while review data is unresolved.
 */
export default function BusinessReviewCardSkeleton() {
  return (
    <View className="border-b border-border-primary px-4 py-4">
      {/* Review author */}
      <View className="flex-row items-center">
        <Skeleton className="h-[38px] w-[38px] rounded-full" />

        <View className="ml-3 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1.5 h-3 w-16" />
        </View>

        <Skeleton className="h-5 w-5 rounded-full" />
      </View>

      {/* Review content */}
      <View className="mt-3 gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[68%]" />
      </View>

      {/* Review photos */}
      <View className="mt-3 flex-row gap-2">
        <Skeleton className="aspect-square flex-1 rounded-lg" />
        <Skeleton className="aspect-square flex-1 rounded-lg" />
        <Skeleton className="aspect-square flex-1 rounded-lg" />
      </View>

      {/* Specialty vouches */}
      <View className="mt-4">
        <View className="mb-2 flex-row items-center">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="ml-1.5 h-3 w-20" />
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </View>
      </View>

      {/* Like action */}
      <View className="mt-3 flex-row items-center">
        <Skeleton className="h-[21px] w-[21px] rounded-full" />
        <Skeleton className="ml-1.5 h-3 w-5" />
      </View>
    </View>
  );
}
