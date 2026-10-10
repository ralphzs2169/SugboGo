import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

type Variant = "information" | "hours" | "photos";

/** Mirrors the three direct editors without exposing uninitialized form values. */
export default function MerchantBusinessEditSkeleton({
  variant,
}: {
  variant: Variant;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={`merchant-business-${variant}-skeleton`}
      className="flex-1 bg-surface"
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-width guidance banner */}
        <View className="flex-row bg-info px-4 py-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <View className="ml-3 flex-1">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
            <Skeleton className="mt-2 h-3 w-4/5 rounded-md" />
          </View>
        </View>

        {/* Editor content */}
        <View className="px-5 pt-5">
          {variant === "information" ? (
            <>
              <FieldSkeleton multiline />
              {[0, 1, 2].map((field) => (
                <FieldSkeleton key={field} />
              ))}
            </>
          ) : variant === "hours" ? (
            <View className="gap-3">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <View
                  key={day}
                  className="rounded-xl border border-border-primary bg-surface p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </View>
                  <Skeleton className="mt-3 h-3 w-36 rounded-md" />
                </View>
              ))}
            </View>
          ) : (
            [0, 1, 2, 3].map((category) => (
              <View
                key={category}
                className="mb-4 rounded-xl border border-border-primary bg-surface p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-4 w-10 rounded-md" />
                </View>
                <View className="mt-3 flex-row gap-3">
                  <Skeleton className="h-24 w-24 rounded-xl" />
                  <Skeleton className="h-24 w-24 rounded-xl" />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Fixed actions */}
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

/** Renders the established label and input proportions for a disabled field. */
function FieldSkeleton({ multiline = false }: { multiline?: boolean }) {
  return (
    <View className="mb-5">
      <Skeleton className="mb-2 h-4 w-32 rounded-md" />
      <Skeleton
        className={`${multiline ? "h-32" : "h-12"} w-full rounded-xl`}
      />
    </View>
  );
}
