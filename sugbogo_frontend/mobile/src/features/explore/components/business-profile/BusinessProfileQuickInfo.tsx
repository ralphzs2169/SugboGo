import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  REVIEW_VIBE_COLORS,
} from "@/shared/constants/reviewVibe";
import type { ReviewVibe } from "@/shared/types/reviewVibe.types";
import type { BusinessSentimentRating as Rating } from "../../types/businessRating.types";
import { usePresentedBusinessRating } from "../../hooks/businessRatingSync";
import { hasDisplayableBusinessRating } from "../../utils/businessRating.utils";

type Props = {
  businessId?: number;
  rating?: Rating | null;
  reviewCount: number | null;
  overallVibe?: ReviewVibe | null;
  statusLabel: string;
  statusDetail: string;
  distance: string | null;
  isOpenNow: boolean | null;
  unavailable?: boolean;
};

/**
 * Displays the business's primary quick-glance information.
 *
 * Keeps operating status and distance inline beneath the identity, with a
 * published-review fallback when no numeric rating is displayed by the hero.
 */
export default function BusinessProfileQuickInfo({
  businessId = 0,
  rating,
  reviewCount,
  overallVibe,
  statusLabel,
  statusDetail,
  distance,
  isOpenNow,
  unavailable = false,
}: Props) {
  const currentRating = usePresentedBusinessRating(businessId, rating);
  const hasRating = !unavailable && hasDisplayableBusinessRating(currentRating);
  const vibe = !unavailable && overallVibe ? overallVibe : null;
  const statusColor =
    isOpenNow === null
      ? theme.extends.colors.text.secondary
      : isOpenNow
        ? theme.extends.colors.success
        : theme.extends.colors.error;

  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
      {/* Published reviews are only needed when the hero has no rating. */}
      {!hasRating && !unavailable && reviewCount !== null && (
        <View
          className="flex-row items-center gap-1.5"
          accessible
          accessibilityLabel={
            vibe
              ? `${reviewCount} reviews. Customer feedback: ${OVERALL_REVIEW_VIBE_LABELS[vibe]}`
              : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
          }
        >
          {vibe && (
            <View
              accessible={false}
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: REVIEW_VIBE_COLORS[vibe].dot }}
            />
          )}
          <AppText className="text-xs text-text-secondary">
            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </AppText>
        </View>
      )}

      {/* Current operating status */}
      <View
        accessible
        accessibilityLabel={
          unavailable
            ? "Current status unavailable"
            : `${statusLabel}${statusDetail ? `. ${statusDetail}` : ""}`
        }
        className="min-w-0 shrink flex-row items-center gap-1.5"
      >
        <MaterialCommunityIcons
          name="clock-outline"
          size={15}
          color={statusColor}
          accessible={false}
        />
        <AppText className="shrink text-xs text-text-secondary">
          <AppText
            weight="bold"
            className={
              isOpenNow === null
                ? "text-text-secondary"
                : isOpenNow
                  ? "text-success"
                  : "text-text-error"
            }
          >
            {unavailable ? "Current status unavailable" : statusLabel}
          </AppText>
          {!unavailable && statusDetail ? ` · ${statusDetail}` : ""}
        </AppText>
      </View>

      {/* Distance remains absent when there is no current location. */}
      {!unavailable && distance !== null && (
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={15}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
          <AppText className="text-xs text-text-secondary">
            {distance} away
          </AppText>
        </View>
      )}
    </View>
  );
}
