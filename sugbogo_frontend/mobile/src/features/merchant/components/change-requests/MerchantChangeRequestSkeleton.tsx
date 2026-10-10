import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

type Variant = "name" | "classification" | "location";

/** Shows a form-shaped cold-load state until profile and eligibility are known. */
export default function MerchantChangeRequestSkeleton({
  variant,
}: {
  variant: Variant;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={`merchant-change-${variant}-skeleton`}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="pt-2"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Request form sections */}
        {variant === "name" ? (
          <View className="bg-surface px-6 py-5">
            <SectionHeading />
            <Skeleton className="mt-5 h-3 w-24 rounded-md" />
            <Skeleton className="mt-2 h-5 w-44 rounded-md" />
            <Skeleton className="mt-6 h-3 w-36 rounded-md" />
            <Skeleton className="mt-2 h-12 w-full rounded-xl" />
          </View>
        ) : variant === "classification" ? (
          <>
            <View className="bg-surface px-6 py-5">
              <SectionHeading />
              <Skeleton className="mt-4 h-5 w-48 rounded-md" />
              <View className="mt-3 flex-row gap-2">
                {[0, 1, 2].map((tag) => (
                  <Skeleton key={tag} className="h-8 w-24 rounded-full" />
                ))}
              </View>
            </View>
            {[0, 1].map((section) => (
              <View key={section} className="mt-2 bg-surface px-6 py-5">
                <SectionHeading />
                <Skeleton className="mt-5 h-12 w-full rounded-xl" />
                <Skeleton className="mt-4 h-12 w-full rounded-xl" />
              </View>
            ))}
          </>
        ) : (
          <>
            <View className="bg-surface px-6 py-5">
              <SectionHeading />
              <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
            </View>
            <View className="mt-2 bg-surface px-6 py-5">
              <SectionHeading />
              {[0, 1, 2].map((field) => (
                <View key={field} className="mt-4">
                  <Skeleton className="mb-2 h-3 w-28 rounded-md" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </View>
              ))}
            </View>
            <View className="mt-2 bg-surface px-6 py-5">
              <SectionHeading />
              <Skeleton className="mt-4 h-14 w-full rounded-xl" />
            </View>
          </>
        )}
      </ScrollView>

      {/* Review actions */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 flex-1 rounded-full" />
      </View>
    </View>
  );
}

/** Matches the icon and heading of a registration-style request section. */
function SectionHeading() {
  return (
    <View className="flex-row items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <View className="flex-1">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="mt-2 h-3 w-52 max-w-full rounded-md" />
      </View>
    </View>
  );
}
