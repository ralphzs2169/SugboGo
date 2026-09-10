import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Mirrors the create-dispute form while its required review data is loading.
 *
 * Preserves the major information, form, evidence, and submission areas so the
 * screen remains visually stable before the real dispute form is available.
 */
export default function CreateReviewDisputeSkeleton() {
  return (
    <View className="flex-1 bg-background">
      {/* Dispute process notice */}
      <View className="bg-info px-4 py-4">
        <View className="flex-row items-start">
          <Skeleton className="h-8 w-8 rounded-full" />

          <View className="ml-3 flex-1">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
            <Skeleton className="mt-2 h-3 w-[78%] rounded-md" />
          </View>
        </View>
      </View>

      {/* Review being disputed */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-48 rounded-md" />
          </View>

          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        <View className="mt-4 rounded-xl border border-border-primary p-4">
          <View className="flex-row items-center">
            <Skeleton className="h-10 w-10 rounded-full" />

            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="mt-2 h-3 w-20 rounded-md" />
            </View>
          </View>

          <Skeleton className="mt-4 h-4 w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-[86%] rounded-md" />
          <Skeleton className="mt-2 h-4 w-[64%] rounded-md" />

          <View className="mt-4 flex-row gap-2">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <Skeleton className="h-20 w-20 rounded-xl" />
          </View>
        </View>
      </View>

      {/* Dispute details */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between border-b border-border-primary pb-3">
          <View className="flex-1">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
            <Skeleton className="mt-2 h-3 w-[82%] rounded-md" />
          </View>

          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        <View className="mt-4">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="mt-2 h-12 w-full rounded-xl" />

          <Skeleton className="mt-5 h-4 w-16 rounded-md" />
          <Skeleton className="mt-2 h-32 w-full rounded-xl" />
          <Skeleton className="mt-2 h-3 w-[88%] rounded-md" />
          <Skeleton className="mt-2 h-3 w-[68%] rounded-md" />
        </View>
      </View>

      {/* Supporting evidence */}
      <View className="mt-2 rounded-md bg-surface px-4 py-5">
        <View className="flex-row items-start justify-between border-b border-border-primary pb-3">
          <View className="flex-1">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="mt-2 h-3 w-52 rounded-md" />
          </View>

          <Skeleton className="h-5 w-5 rounded-md" />
        </View>

        <View className="mt-4">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="mt-2 h-3 w-20 rounded-md" />

          <View className="mt-4 items-center rounded-xl border border-dashed border-border-primary px-5 py-7">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="mt-3 h-4 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-48 rounded-md" />
          </View>

          <View className="mt-4 flex-row gap-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </View>

          <Skeleton className="mx-auto mt-3 h-3 w-56 rounded-md" />
        </View>
      </View>
    </View>
  );
}
