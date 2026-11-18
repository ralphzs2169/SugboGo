import { useWindowDimensions, View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

import { getBusinessCardWidth } from "../new-businesses/BusinessCard";

type Props = {
  variant?: "default" | "featured";
};

/**
 * Displays card-shaped loading placeholders for Explore business carousels.
 *
 * Mirrors the major BusinessCard regions so loading transitions into business
 * content with minimal visual shift.
 */
export default function ExploreBusinessCarouselSkeleton({
  variant = "default",
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = getBusinessCardWidth(screenWidth, variant);

  return (
    <View className="overflow-hidden">
      {/* Carousel card placeholders */}
      <View className="flex-row gap-3 px-4">
        {[0, 1].map((item) => (
          <View
            key={item}
            style={{ width: cardWidth }}
            className="overflow-hidden rounded-card border border-border-primary bg-surface"
          >
            {/* Business image */}
            <Skeleton className="h-[190px] w-full rounded-none" />

            {/* Business content */}
            <View className="px-3 pb-3 pt-3">
              {/* Business identity */}
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />

              {/* Specialty tags */}
              <View className="mt-3 flex-row gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </View>

              {/* Business metadata */}
              <View className="mt-4 flex-row items-center justify-between">
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
