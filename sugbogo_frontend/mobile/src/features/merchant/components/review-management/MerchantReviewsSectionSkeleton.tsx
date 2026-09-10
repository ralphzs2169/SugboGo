import { View } from "react-native";

/**
 * Displays a compact loading placeholder for the reviews feed during retries.
 *
 * Keeps the surrounding reviews page visible while only the affected section
 * reloads.
 */
export default function MerchantReviewsSectionSkeleton() {
  return (
    <View className="gap-4 py-2">
      {/* Review filters placeholder */}
      <View className="flex-row gap-2">
        <View className="h-11 w-16 rounded-full bg-disabled" />
        <View className="h-11 w-28 rounded-full bg-disabled" />
        <View className="h-11 w-20 rounded-full bg-disabled" />
      </View>

      {/* Review cards placeholder */}
      <View className="rounded-card border border-border-primary bg-surface p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 rounded-full bg-disabled" />

          <View className="flex-1 gap-2">
            <View className="h-3 w-28 rounded-full bg-disabled" />
            <View className="h-3 w-20 rounded-full bg-disabled" />
          </View>
        </View>

        <View className="mt-4 gap-2">
          <View className="h-3 w-full rounded-full bg-disabled" />
          <View className="h-3 w-5/6 rounded-full bg-disabled" />
          <View className="h-3 w-2/3 rounded-full bg-disabled" />
        </View>
      </View>

      <View className="rounded-card border border-border-primary bg-surface p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 rounded-full bg-disabled" />

          <View className="flex-1 gap-2">
            <View className="h-3 w-24 rounded-full bg-disabled" />
            <View className="h-3 w-16 rounded-full bg-disabled" />
          </View>
        </View>

        <View className="mt-4 gap-2">
          <View className="h-3 w-full rounded-full bg-disabled" />
          <View className="h-3 w-4/5 rounded-full bg-disabled" />
        </View>
      </View>
    </View>
  );
}
