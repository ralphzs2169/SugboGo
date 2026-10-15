import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Displays loading placeholders matching the full-width Community feed.
 *
 * Mirrors reviewer identity, optional photos, review content, interactions,
 * and business links without introducing card-style containers.
 */
export default function CommunityFeedSkeleton() {
  return (
    <View
      testID="community-feed-skeleton"
      accessibilityLabel="Loading Community reviews"
      accessibilityState={{ busy: true }}
      className="bg-background"
    >
      {[0, 1].map((item) => (
        <View key={item}>
          {/* Spacing between feed posts */}
          {item > 0 && <View className="h-2 bg-background" />}

          <View className="border-b border-border-primary bg-surface">
            {/* Reviewer identity */}
            <View className="flex-row items-center px-4 pb-3 pt-4">
              <Skeleton className="h-9 w-9 rounded-full" />

              <View className="ml-2.5 flex-1 gap-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </View>
            </View>

            {/* Full-width photo carousel placeholder */}
            {item === 0 && <Skeleton className="h-56 w-full rounded-none" />}

            {/* Review text */}
            <View className="px-4 pt-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="mt-2 h-4 w-11/12 rounded" />
              <Skeleton className="mt-2 h-4 w-3/4 rounded" />
            </View>

            {/* Specialty vouches */}
            {item === 0 && (
              <View className="mt-3 px-4">
                <Skeleton className="mb-2 h-3 w-24 rounded" />

                <View className="flex-row gap-2">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </View>
              </View>
            )}

            {/* Optional merchant response */}
            {item === 1 && (
              <View className="mt-3 px-4">
                <View className="rounded-lg bg-surface-muted p-3">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="mt-3 h-3 w-full rounded" />
                  <Skeleton className="mt-2 h-3 w-3/4 rounded" />
                </View>
              </View>
            )}

            {/* Helpful interaction */}
            <View className="mt-2 min-h-12 flex-row items-center px-4">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="ml-2 h-3 w-20 rounded" />
            </View>

            {/* Business context footer */}
            <View className="mt-1 border-t border-border-primary px-4 pb-3 pt-2">
              <View className="min-h-12 flex-row items-center">
                {/* Review-to-business connector */}
                <Skeleton className="mr-2 h-5 w-5 rounded" />

                {/* Business thumbnail */}
                <Skeleton className="h-9 w-9 rounded-md" />

                {/* Business identity */}
                <View className="ml-2.5 min-w-0 flex-1 gap-2">
                  <Skeleton className="h-3.5 w-36 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </View>

                {/* Navigation chevron */}
                <Skeleton className="h-4 w-4 rounded" />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
