import { useWindowDimensions, View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

type Props = {
  count?: number;
  testID?: string;
  applyXPadding?: boolean;
};

/**
 * Displays loading placeholders for vertically stacked compact business cards.
 *
 * Mirrors the compact BusinessCard layout so Explore result and collection
 * screens can share a consistent loading state.
 */
export default function CompactBusinessListSkeleton({
  count = 4,
  testID,
  applyXPadding = true,
}: Props) {
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(
    176,
    Math.max(128, Math.round((width - 32) * 0.44)),
  );
  return (
    <View className="pt-1" testID={testID}>
      {/* Compact business placeholders */}
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} className={`mb-3 ${applyXPadding ? "px-4" : ""}`}>
          <View className="min-h-40 w-full flex-row overflow-hidden rounded-card border border-border-primary bg-surface">
            {/* Business image */}
            <View
              style={{ width: imageWidth }}
              className="shrink-0 self-stretch"
            >
              <Skeleton className="h-full w-full" />
            </View>

            {/* Business information */}
            <View className="min-h-40 min-w-0 flex-1 justify-between p-3">
              <View>
                {/* Business identity */}
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
