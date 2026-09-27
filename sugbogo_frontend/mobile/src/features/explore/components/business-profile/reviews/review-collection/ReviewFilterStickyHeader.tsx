import { Animated, View } from "react-native";

import type { BusinessReviewFilters } from "../../../../types/review.types";
import ReviewFilterControls from "./ReviewFilterControls";

type Props = {
  visible: boolean;
  opacity: Animated.Value;
  translateY: Animated.Value;
  filters: BusinessReviewFilters;
  onChange: (filters: BusinessReviewFilters) => void;
  onClear: () => void;
  onOpenFilter: () => void;
};

/**
 * Displays review filtering and sorting controls above the scrolling review list.
 *
 * Appears once the inline controls reach the top of the viewport and keeps the
 * filtering experience compact while reviews continue scrolling underneath.
 */
export default function ReviewFiltersStickyHeader({
  visible,
  opacity,
  translateY,
  filters,
  onChange,
  onClear,
  onOpenFilter,
}: Props) {
  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        elevation: 4,
        opacity,
        transform: [{ translateY }],
      }}
    >
      {/* Sticky filter controls */}
      <View className="border-b border-border-primary bg-surface px-4 pb-2 ">
        <ReviewFilterControls
          filters={filters}
          onChange={onChange}
          onClear={onClear}
          onOpenFilter={onOpenFilter}
        />
      </View>
    </Animated.View>
  );
}
