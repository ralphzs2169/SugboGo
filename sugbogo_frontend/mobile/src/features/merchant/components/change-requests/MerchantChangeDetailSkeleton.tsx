import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

/** Mirrors request details without guessing an unknown approval status. */
export default function MerchantChangeDetailSkeleton() {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        testID="merchant-change-detail-skeleton"
        contentContainerClassName="px-4 pb-10 pt-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Neutral status presentation */}
        <View className="mb-6 items-center px-3 pb-2">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="mt-4 h-6 w-28 rounded-full" />
          <Skeleton className="mt-4 h-6 w-64 max-w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-36 rounded-md" />
        </View>

        {/* Submitted changes and reason */}
        <View className="mb-4 rounded-2xl border border-border-primary/70 bg-surface p-4">
          <View className="border-b border-border-primary/60 pb-3">
            <Skeleton className="h-4 w-40 rounded-md" />
          </View>
          <Skeleton className="mt-4 h-3 w-24 rounded-md" />
          <Skeleton className="mt-2 h-5 w-48 rounded-md" />
          <Skeleton className="mx-auto my-5 h-5 w-5 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="mt-2 h-5 w-52 rounded-md" />
        </View>
        <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
          <View className="border-b border-border-primary/60 pb-3">
            <Skeleton className="h-4 w-36 rounded-md" />
          </View>
          <Skeleton className="mt-4 h-4 w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
