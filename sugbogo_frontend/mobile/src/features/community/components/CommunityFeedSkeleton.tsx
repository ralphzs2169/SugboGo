import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Displays loading placeholders that mirror Community review-card structure.
 */
export default function CommunityFeedSkeleton() {
  return (
    <View testID="community-loading" className="gap-3 px-4 py-4">
      {[0, 1].map((item) => (
        <View
          key={item}
          className="rounded-card border border-border-primary bg-surface p-4"
        >
          {/* Reviewer identity */}
          <View className="flex-row items-center">
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-16 rounded-md" />
            </View>
          </View>

          {/* Business context */}
          <View className="mt-3 flex-row rounded-xl border border-border-primary p-2.5">
            <Skeleton className="h-14 w-14 rounded-lg" />
            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-4/5 rounded-md" />
              <Skeleton className="mt-2 h-3 w-2/5 rounded-md" />
              <Skeleton className="mt-2 h-3 w-3/5 rounded-md" />
            </View>
          </View>

          {/* Review content */}
          <View className="mt-4 gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-[92%] rounded-md" />
            <Skeleton className="h-4 w-[65%] rounded-md" />
          </View>

          <View className="mt-3 flex-row gap-2">
            <Skeleton className="aspect-square flex-1 rounded-lg" />
            <Skeleton className="aspect-square flex-1 rounded-lg" />
            <Skeleton className="aspect-square flex-1 rounded-lg" />
          </View>

          <Skeleton className="mt-4 h-5 w-24 rounded-md" />
        </View>
      ))}
    </View>
  );
}
