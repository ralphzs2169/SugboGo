import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Mirrors the reply templates screen while template data is loading.
 *
 * Preserves the screen guidance, template card structure, and floating add
 * action so the page remains visually stable during the initial request.
 */
export default function ReplyTemplatesScreenSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface">
      {/* Loading template collection */}
      <FlatList
        data={[1, 2, 3]}
        keyExtractor={(item) => String(item)}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 120,
        }}
        ListHeaderComponent={
          <View className="mb-5">
            {/* Screen guidance */}
            <Skeleton className="h-4 w-[88%] rounded-md" />
            <Skeleton className="mt-2 h-4 w-[70%] rounded-md" />
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={() => (
          <View className="overflow-hidden rounded-card border border-border-primary bg-surface">
            {/* Template header */}
            <View className="flex-row items-start px-4 pb-3 pt-4">
              <View className="h-10 w-10 shrink-0 items-center justify-center">
                <Skeleton className="h-5 w-5 rounded-md" />
              </View>

              <View className="min-w-0 flex-1 pt-0.5">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="mt-2 h-3 w-24 rounded-md" />
              </View>

              <Skeleton className="h-9 w-9 rounded-full" />
            </View>

            {/* Reply preview */}
            <View className="mx-4 mb-4 rounded-xl bg-background px-3.5 py-3">
              <View className="mb-2 flex-row items-center">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="ml-2 h-3 w-16 rounded-md" />
              </View>

              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="mt-2 h-4 w-[92%] rounded-md" />
              <Skeleton className="mt-2 h-4 w-[68%] rounded-md" />

              <Skeleton className="mt-3 h-3 w-16 rounded-md" />
            </View>
          </View>
        )}
      />

      {/* Loading add action */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 items-center px-4"
        style={{
          bottom: insets.bottom + 12,
        }}
      >
        <Skeleton className="h-12 w-36 rounded-full" />
      </View>
    </View>
  );
}
