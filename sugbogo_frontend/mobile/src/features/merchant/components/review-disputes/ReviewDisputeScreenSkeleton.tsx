import { View } from "react-native";
import Skeleton from "@/shared/components/Skeleton";

/**
 * Mirrors the dispute list hierarchy while merchant disputes are loading.
 */
export default function ReviewDisputesSkeleton() {
  return (
    <View className="flex-1 bg-background px-4 pt-4">
      {/* Header skeleton */}
      <Skeleton className="h-4 w-72 rounded-md" />

      <View className="mt-4 flex-row gap-2">
        <Skeleton className="h-10 w-16 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </View>

      {/* Dispute card skeletons */}
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          className="mt-3 rounded-card border border-border-primary bg-surface p-4"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="mt-2 h-4 w-44 rounded-md" />
              <Skeleton className="mt-2 h-3 w-32 rounded-md" />
            </View>

            <Skeleton className="h-7 w-20 rounded-full" />
          </View>

          <View className="mt-4 rounded-xl bg-background px-3.5 py-3">
            <Skeleton className="h-4 w-4 rounded-md" />
            <Skeleton className="mt-2 h-4 w-full rounded-md" />
            <Skeleton className="mt-2 h-4 w-[78%] rounded-md" />
          </View>

          <View className="mt-4 flex-row items-center justify-between border-t border-border-primary pt-3">
            <Skeleton className="h-3 w-36 rounded-md" />
            <Skeleton className="h-5 w-5 rounded-md" />
          </View>
        </View>
      ))}
    </View>
  );
}
