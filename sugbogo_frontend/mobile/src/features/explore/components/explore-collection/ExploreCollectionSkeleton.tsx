import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

const SKELETON_CARD_COUNT = 4;

/**
 * Displays loading placeholders matching the compact Explore business card.
 *
 * Mirrors the compact card's image, business identity, metadata, and specialty
 * tag layout so loading transitions preserve the final result structure.
 */
export default function ExploreCollectionSkeleton() {
  return (
    <View className="pt-1" testID="collection-loading">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <View key={index} className="mb-3 px-4">
          {/* Compact business card */}
          <View className="w-full flex-row overflow-hidden rounded-card border border-border-primary bg-surface p-2.5">
            {/* Business image */}
            <Skeleton className="h-[108px] w-[108px] shrink-0 rounded-xl" />

            {/* Business details */}
            <View className="min-w-0 flex-1 justify-between py-0.5 pl-3">
              <View>
                {/* Business name */}
                <Skeleton className="h-4 w-4/5 rounded-md" />

                <Skeleton className="mt-1.5 h-4 w-3/5 rounded-md" />

                {/* Category and distance */}
                <View className="mt-2 flex-row items-center justify-between">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-3 w-14 rounded-md" />
                </View>
              </View>

              {/* Specialty tags */}
              <View className="mt-2 flex-row flex-wrap gap-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
