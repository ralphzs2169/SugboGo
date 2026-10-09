import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

/** Mirrors Manage Business's grouped navigation while the profile first loads. */
export default function ManageBusinessSkeleton() {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        testID="manage-business-skeleton"
        contentContainerClassName="px-4 pb-10 pt-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <Skeleton className="mb-8 ml-1 h-4 w-64 max-w-full rounded-md" />

        {/* Direct-edit navigation */}
        <Skeleton className="ml-1 h-5 w-36 rounded-md" />
        <Skeleton className="mb-3 ml-1 mt-2 h-3 w-56 rounded-md" />
        <NavigationRows />

        {/* Approval-required navigation */}
        <Skeleton className="ml-1 mt-8 h-5 w-52 rounded-md" />
        <View className="mb-3 mt-3 rounded-xl bg-info px-3 py-3">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="mt-2 h-3 w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-4/5 rounded-md" />
        </View>
        <NavigationRows />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Keeps the three noninteractive row placeholders aligned with the real menu. */
function NavigationRows() {
  return (
    <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          className={`min-h-[72px] flex-row items-center px-4 py-3.5 ${row < 2 ? "border-b border-border-primary/60" : ""}`}
        >
          <Skeleton className="mr-3 h-10 w-10 rounded-xl" />
          <View className="min-w-0 flex-1">
            <Skeleton className="h-4 w-36 max-w-full rounded-md" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full rounded-md" />
          </View>
          <Skeleton className="h-4 w-4 rounded-md" />
        </View>
      ))}
    </View>
  );
}
