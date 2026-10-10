import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

/**
 * Mirrors the Merchant Profile during its first business-profile fetch.
 * Keeps its section spacing and collapsed detail rows without exposing actions.
 */
export default function MerchantProfileSkeleton() {
  const bottomSpacing = useTabBarSpacing();

  return (
    <View testID="merchant-profile-skeleton" className="flex-1 bg-background">
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <ScrollView
          testID="merchant-profile-skeleton-scroll"
          className="flex-1"
          contentContainerClassName="flex-grow"
          contentContainerStyle={{ paddingBottom: bottomSpacing }}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover and overlapping business identity */}
          <View testID="merchant-profile-skeleton-hero" className="bg-surface">
            <View className="h-56 w-full bg-surface-secondary">
              <Skeleton className="h-full w-full rounded-none" />
            </View>
            <View className="-mt-7 rounded-t-[28px] bg-surface px-5 pb-3">
              <View className="flex-row items-end">
                <View className="-mt-9 h-20 w-20 items-center justify-center rounded-full border-4 border-surface bg-background">
                  <Skeleton className="h-[72px] w-[72px] rounded-full" />
                </View>
              </View>
              <View className="mt-2 flex-row items-start justify-between gap-3">
                <Skeleton className="h-7 w-48 max-w-[65%] rounded-md" />
                <Skeleton className="mt-1 h-7 w-20 rounded-full" />
              </View>
              <Skeleton className="mt-2 h-4 w-40 rounded-md" />
            </View>
          </View>

          {/* Primary actions and overview */}
          <View className="bg-surface pb-4">
            <View
              testID="merchant-profile-skeleton-actions"
              className="flex-row gap-2 px-5 pt-3"
            >
              <Skeleton className="h-12 min-w-0 flex-1 rounded-full" />
              <Skeleton className="h-12 min-w-0 flex-1 rounded-full" />
            </View>

            <View
              testID="merchant-profile-skeleton-overview"
              className="px-5 pt-6"
            >
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="mt-2 h-3 w-52 max-w-full rounded-md" />
              <View className="mt-4 flex-row gap-2">
                {[0, 1, 2].map((metric) => (
                  <View
                    key={metric}
                    className="min-w-0 flex-1 rounded-xl border border-border-primary/70 bg-surface px-3 py-3"
                  >
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="mt-3 h-3 w-12 max-w-full rounded-md" />
                    <Skeleton className="mt-2 h-4 w-16 max-w-full rounded-md" />
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Business introduction and specialties */}
          <View className="mt-2 bg-surface px-5 pb-5 pt-4">
            <View className="flex-row items-center justify-between gap-3">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </View>
            <View className="mt-4 gap-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </View>
            <View className="mt-4 border-t border-border-primary/60 pt-4">
              <Skeleton className="h-3 w-20 rounded-md" />
              <View className="mt-2 flex-row flex-wrap gap-1">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </View>
            </View>
          </View>

          <View className="bg-background pb-2">
            {/* Business photo collage */}
            <View className="mb-2 mt-2 bg-surface px-5 pb-5 pt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </View>
              <View className="h-48 flex-row gap-2">
                <Skeleton className="min-w-0 flex-[2] rounded-xl" />
                <View className="min-w-0 flex-1 gap-2">
                  <Skeleton className="min-h-0 flex-1 rounded-xl" />
                  <Skeleton className="min-h-0 flex-1 rounded-xl" />
                </View>
              </View>
              <Skeleton className="mt-2 h-3 w-28 rounded-md" />
            </View>

            {/* Business details in their default collapsed state */}
            <View
              testID="merchant-profile-skeleton-details"
              className="mb-2 bg-surface px-5 pb-2 pt-4"
            >
              <Skeleton className="h-5 w-32 rounded-md" />
              <View className="pb-4 pt-4">
                <View className="flex-row items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="ml-auto h-4 w-10 rounded-md" />
                </View>
                <View className="mt-2 rounded-xl border border-border-primary bg-surface px-3 py-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <View className="mt-3 flex-row justify-between gap-3">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-28 rounded-md" />
                  </View>
                  <View className="mt-3 flex-row items-center justify-between border-t border-border-primary/60 pt-3">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-4 w-5 rounded-md" />
                  </View>
                </View>
              </View>
              {[0, 1].map((row) => (
                <View
                  key={row}
                  className="min-h-14 flex-row items-center gap-2 border-t border-border-primary/60 py-3"
                >
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <View className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    {row === 0 ? (
                      <Skeleton className="mt-2 h-3 w-44 max-w-full rounded-md" />
                    ) : null}
                  </View>
                  <Skeleton className="h-5 w-5 rounded-md" />
                </View>
              ))}
            </View>

            {/* Secondary actions and session action */}
            <View
              testID="merchant-profile-skeleton-more"
              className="bg-surface px-5 pb-3 pt-4"
            >
              <Skeleton className="mb-2 h-5 w-14 rounded-md" />
              {[0, 1].map((row) => (
                <View
                  key={row}
                  className={`min-h-14 flex-row items-center gap-3 ${row === 1 ? "border-t border-border-primary/60" : ""}`}
                >
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <View className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    {row === 0 ? (
                      <Skeleton className="mt-2 h-3 w-48 max-w-full rounded-md" />
                    ) : null}
                  </View>
                  <Skeleton className="h-5 w-5 rounded-md" />
                </View>
              ))}
            </View>
          </View>

          <View className="mb-4 bg-surface px-5">
            <View className="min-h-14 flex-row items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
