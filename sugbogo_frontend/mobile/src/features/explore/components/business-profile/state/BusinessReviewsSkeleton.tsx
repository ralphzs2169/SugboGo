import { ScrollView, View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

type Props = {
  bottomInset: number;
  showOwnerFooter?: boolean;
};

/** Mirrors the collection's insights, filters, and reviews during initial loading. */
export default function BusinessReviewsSkeleton({
  bottomInset,
  showOwnerFooter = false,
}: Props) {
  return (
    <View
      className="flex-1 bg-surface"
      accessible
      accessibilityLabel="Loading reviews"
      accessibilityState={{ busy: true }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        contentContainerStyle={{
          paddingBottom: showOwnerFooter ? 128 : bottomInset + 32,
        }}
      >
        <View className="gap-5 px-4 pb-4 pt-5">
          {/* Insights heading and rolling-window context */}
          <View>
            <View className="flex-row items-center justify-between gap-3">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </View>
            <Skeleton className="mt-2 h-3 w-64 rounded-md" />
          </View>

          {/* Generated summary */}
          <View className="rounded-xl bg-background px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </View>
            <View className="mt-3 gap-2">
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-3 w-3/4 rounded-md" />
            </View>
          </View>

          {/* Frequently mentioned topics */}
          <View>
            <Skeleton className="mb-3 h-4 w-36 rounded-md" />
            <View className="flex-row gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </View>
          </View>

          {/* Inline filtering and sorting controls */}
          <View className="flex-row gap-2 overflow-hidden py-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </View>
        </View>

        {/* Review rows use the same outer and inner insets as the live list. */}
        <View className="px-4">
          <ReviewRowSkeleton showPhotos />
          <ReviewRowSkeleton />
        </View>
      </ScrollView>

      {/* Only business owners have a fixed management footer. */}
      {showOwnerFooter && (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border-primary bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 12) }}
        >
          <Skeleton className="h-11 w-full rounded-full" />
        </View>
      )}
    </View>
  );
}

/** Matches the current compact review identity, content, photos, and engagement. */
function ReviewRowSkeleton({ showPhotos = false }: { showPhotos?: boolean }) {
  return (
    <View className="border-t border-border-primary px-4 py-5">
      {/* Reviewer identity */}
      <View className="flex-row items-center">
        <Skeleton className="h-9 w-9 rounded-full" />
        <View className="ml-2.5 flex-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="mt-1 h-3 w-16 rounded-md" />
        </View>
        <Skeleton className="h-5 w-5 rounded-full" />
      </View>

      {/* Review text */}
      <View className="mt-3 gap-2">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-2/3 rounded-md" />
      </View>

      {/* Optional photo grid */}
      {showPhotos && (
        <View className="mt-3 flex-row gap-1.5">
          <Skeleton className="aspect-square w-[32%] rounded-lg" />
          <Skeleton className="aspect-square w-[32%] rounded-lg" />
          <Skeleton className="aspect-square w-[32%] rounded-lg" />
        </View>
      )}

      {/* Specialty tags and engagement */}
      <View className="mt-3">
        <Skeleton className="mb-1.5 h-3 w-20 rounded-md" />
        <View className="flex-row gap-1">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </View>
      </View>
      <View className="mt-3 flex-row items-center gap-1.5 py-1">
        <Skeleton className="h-[18px] w-[18px] rounded-full" />
        <Skeleton className="h-3 w-5 rounded-md" />
      </View>
    </View>
  );
}
