import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Renders the loading state for the Your Interests screen while preserving
 * the final section structure and persistent footer spacing.
 */
export default function YourInterestsSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Personalization guidance */}
        <View className="overflow-hidden rounded-md bg-surface px-4 py-5">
          {/* Personalization card */}
          <View className="flex-row items-center rounded-xl border border-border-primary px-5 py-4">
            <View className="min-w-0 flex-1">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="mt-3 h-5 w-44 rounded-md" />
              <Skeleton className="mt-2 h-3 w-full rounded-md" />
              <Skeleton className="mt-2 h-3 w-4/5 rounded-md" />
            </View>

            <Skeleton className="ml-3 h-[84px] w-[84px] shrink-0 rounded-full" />
          </View>

          {/* Collapsed recommendation info */}
          <View className="mt-4 flex-row items-center rounded-xl border border-border-primary px-4 py-4">
            <Skeleton className="h-9 w-9 rounded-full" />

            <View className="ml-3 min-w-0 flex-1">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="mt-2 h-3 w-full rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-3/4 rounded-md" />
            </View>

            <Skeleton className="ml-3 h-5 w-5 rounded-md" />
          </View>
        </View>

        {/* Category interests */}
        <View className="overflow-hidden rounded-md bg-surface px-4 py-5">
          {/* Section header */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-4">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="mt-2 h-3 w-full rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-3/4 rounded-md" />
            </View>

            <Skeleton className="h-7 w-20 rounded-full" />
          </View>

          {/* Category groups */}
          <View className="gap-3">
            <View className="rounded-xl border border-border-primary px-4 py-4">
              {/* Cluster heading */}
              <View className="flex-row items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="ml-2 h-4 w-28 rounded-md" />
              </View>

              {/* Category choices */}
              <View className="mt-3 flex-row flex-wrap">
                <Skeleton className="mb-2 mr-2 h-10 w-24 rounded-lg" />
                <Skeleton className="mb-2 mr-2 h-10 w-28 rounded-lg" />
                <Skeleton className="mb-2 mr-2 h-10 w-20 rounded-lg" />
                <Skeleton className="mb-2 mr-2 h-10 w-32 rounded-lg" />
              </View>
            </View>

            <View className="rounded-xl border border-border-primary px-4 py-4">
              {/* Cluster heading */}
              <View className="flex-row items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="ml-2 h-4 w-32 rounded-md" />
              </View>

              {/* Category choices */}
              <View className="mt-3 flex-row flex-wrap">
                <Skeleton className="mb-2 mr-2 h-10 w-20 rounded-lg" />
                <Skeleton className="mb-2 mr-2 h-10 w-32 rounded-lg" />
                <Skeleton className="mb-2 mr-2 h-10 w-24 rounded-lg" />
              </View>
            </View>
          </View>
        </View>

        {/* Specialty interests */}
        <View className="overflow-hidden rounded-md bg-surface px-4 py-5">
          {/* Section header */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-4">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="mt-2 h-3 w-full rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-4/5 rounded-md" />
            </View>

            <Skeleton className="h-7 w-20 rounded-full" />
          </View>

          {/* Specialty choices */}
          <View className="flex-row flex-wrap py-4">
            <Skeleton className="mb-2 mr-2 h-12 w-28 rounded-full" />
            <Skeleton className="mb-2 mr-2 h-12 w-24 rounded-full" />
            <Skeleton className="mb-2 mr-2 h-12 w-32 rounded-full" />
            <Skeleton className="mb-2 mr-2 h-12 w-20 rounded-full" />
            <Skeleton className="mb-2 mr-2 h-12 w-28 rounded-full" />
            <Skeleton className="mb-2 mr-2 h-12 w-24 rounded-full" />
          </View>
        </View>
      </ScrollView>

      {/* Save footer placeholder */}
      <View
        className="border-t border-border-primary bg-surface px-5 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <Skeleton className="h-12 w-full rounded-full" />
      </View>
    </View>
  );
}
