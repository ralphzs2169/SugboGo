import { useWindowDimensions, View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

import {
  BUSINESS_CARD_HERO_HEIGHT,
  getBusinessCardWidth,
} from "../new-businesses/BusinessCard";

type Props = {
  variant?: "default" | "featured";
  hiddenGemsOnly?: boolean;
};

/**
 * Displays card-shaped loading placeholders for Explore business carousels.
 *
 * Mirrors the major BusinessCard regions so loading transitions into business
 * content with minimal visual shift.
 */
export default function ExploreBusinessCarouselSkeleton({
  variant = "default",
  hiddenGemsOnly = false,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = getBusinessCardWidth(screenWidth, variant);

  return (
    <View className="overflow-hidden">
      {/* Carousel card placeholders */}
      <View className={`flex-row gap-3 px-4 ${hiddenGemsOnly ? "pt-3" : ""}`}>
        {[0, 1].map((item) => (
          <View
            key={item}
            style={{ width: cardWidth }}
            className="mb-2 mr-3 overflow-hidden rounded-card border border-border-primary bg-surface"
          >
            {/* Business image */}
            <View style={{ height: BUSINESS_CARD_HERO_HEIGHT }}>
              <Skeleton className="w-full flex-1 rounded-none" />
            </View>

            {/* Business content */}
            <View className="px-3 pb-3 pt-3">
              {/* Business identity */}
              <Skeleton className="h-5 w-3/4 rounded-md" />

              {/* Rating or published review count */}
              <Skeleton className="mt-2 h-4 w-1/2 rounded-md" />

              {/* Specialty tags */}
              <View className="mb-2 mt-2 flex-row gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
