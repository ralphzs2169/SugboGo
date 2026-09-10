import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Mirrors the dispute detail hierarchy while the initial dispute data loads.
 *
 * Matches the full-width section layout used by the real dispute detail screen
 * while keeping the major content areas visually stable during loading.
 */
export default function ReviewDisputeDetailSkeleton() {
  return (
    <View className="flex-1 bg-background">
      {/* Dispute overview */}
      <View className="rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-24 rounded-md" />
          </View>

          <Skeleton className="h-7 w-20 rounded-full" />
        </View>

        <Skeleton className="mt-5 h-16 w-full rounded-xl" />

        <View className="mt-5">
          <View className="flex-row">
            <Skeleton className="h-3 w-3 rounded-full" />

            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="mt-2 h-3 w-24 rounded-md" />
            </View>
          </View>

          <View className="my-1 ml-[5px] h-7 w-px bg-border-primary" />

          <View className="flex-row">
            <Skeleton className="h-3 w-3 rounded-full" />

            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="mt-2 h-3 w-20 rounded-md" />
            </View>
          </View>
        </View>
      </View>

      {/* Disputed review */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-center justify-between border-b border-border-primary pb-3">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        <View className="mt-4 flex-row items-center">
          <Skeleton className="h-10 w-10 rounded-full" />

          <View className="ml-3 flex-1">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="mt-2 h-3 w-20 rounded-md" />
          </View>
        </View>

        <Skeleton className="mt-4 h-4 w-full rounded-md" />
        <Skeleton className="mt-2 h-4 w-[86%] rounded-md" />
        <Skeleton className="mt-2 h-4 w-[68%] rounded-md" />

        <View className="my-5 flex-row items-center">
          <View className="h-px flex-1 bg-border-primary" />
          <Skeleton className="mx-3 h-3 w-24 rounded-md" />
          <View className="h-px flex-1 bg-border-primary" />
        </View>

        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="mt-4 h-3 w-28 rounded-md" />
        <Skeleton className="mt-2 h-20 w-full rounded-xl" />
      </View>

      {/* Supporting evidence */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between border-b border-border-primary pb-3">
          <View className="flex-1">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="mt-2 h-3 w-56 rounded-md" />
          </View>

          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        <View className="mt-4">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="mt-2 h-3 w-20 rounded-md" />

          {[1, 2].map((item) => (
            <View
              key={item}
              className="mt-3 flex-row items-center rounded-xl border border-border-primary p-3"
            >
              <Skeleton className="h-[52px] w-[52px] rounded-xl" />

              <View className="ml-3 flex-1">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="mt-2 h-3 w-20 rounded-md" />
              </View>

              <Skeleton className="h-9 w-9 rounded-full" />
            </View>
          ))}

          <View className="mt-4 flex-row gap-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </View>

          <Skeleton className="mx-auto mt-3 h-3 w-44 rounded-md" />
        </View>
      </View>

      {/* Previous disputes */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between border-b border-border-primary pb-3">
          <View className="flex-1">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-44 rounded-md" />
          </View>

          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        {[1, 2].map((item) => (
          <View
            key={item}
            className="mt-3 flex-row items-center rounded-xl border border-border-primary p-4"
          >
            <Skeleton className="h-10 w-10 rounded-full" />

            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="mt-2 h-3 w-20 rounded-md" />
            </View>

            <Skeleton className="h-7 w-20 rounded-full" />
          </View>
        ))}
      </View>

      {/* Pending dispute action */}
      <View className="mt-2 bg-surface px-4 py-3">
        <Skeleton className="h-12 w-full rounded-full" />
      </View>
    </View>
  );
}
