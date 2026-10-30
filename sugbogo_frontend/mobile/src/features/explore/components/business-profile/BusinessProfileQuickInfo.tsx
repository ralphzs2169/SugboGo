import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  REVIEW_VIBE_COLORS,
} from "@/shared/constants/reviewVibe";
import type { ReviewVibe } from "@/shared/types/reviewVibe.types";
import { shadows } from "@/shared/styles/shadows";
import type { BusinessSentimentRating as Rating } from "../../types/businessRating.types";
import { usePresentedBusinessRating } from "../../hooks/businessRatingSync";
import { hasDisplayableBusinessRating } from "../../utils/businessRating.utils";
import BusinessSentimentRating from "./BusinessSentimentRating";

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
 * Presents a rating or review count, operating status, and distance in a compact elevated
 * three-column surface with inset separators for easy visual scanning.
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
    <View className="rounded-xl bg-surface" style={shadows.elevated}>
      {/* Quick information surface */}
      <View className="flex-row items-stretch overflow-hidden rounded-xl border border-border-primary bg-surface">
        {/* Rating or review summary */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={unavailable ? "Reviews unavailable" : undefined}
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          {hasRating ? (
            <>
              <BusinessSentimentRating
                businessId={businessId}
                rating={currentRating}
                variant="stat"
              />
              <AppText className="text-[11px] text-text-secondary">
                rating
              </AppText>
            </>
          ) : (
            <>
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color={theme.extends.colors.text.secondary}
              />

              <View
                className="mt-0.5 flex-row items-center justify-center gap-1.5"
                accessible={vibe ? true : undefined}
                accessibilityLabel={
                  vibe
                    ? `${reviewCount ?? "—"} reviews. Customer feedback: ${OVERALL_REVIEW_VIBE_LABELS[vibe]}`
                    : undefined
                }
              >
                {vibe && (
                  <View
                    accessible={false}
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: REVIEW_VIBE_COLORS[vibe].dot }}
                  />
                )}
                <AppText
                  weight="bold"
                  className="text-center text-[13px] text-text-primary"
                >
                  {unavailable ? "—" : (reviewCount ?? "—")}
                </AppText>
              </View>

              <AppText className="text-[11px] text-text-secondary">
                {unavailable
                  ? "Reviews"
                  : reviewCount === 1
                    ? "review"
                    : "reviews"}
              </AppText>
            </>
          )}
        </View>

        {/* Review and status divider */}
        <View className="my-3 w-px bg-border-primary" />

        {/* Operating status */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={
            unavailable ? "Current status unavailable" : undefined
          }
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={statusColor}
          />

          <AppText
            weight="bold"
            className={`mt-0.5 text-center text-[13px] ${
              isOpenNow === null
                ? "text-text-secondary"
                : isOpenNow
                  ? "text-success"
                  : "text-text-error"
            }`}
            numberOfLines={unavailable || isOpenNow === null ? undefined : 1}
          >
            {unavailable ? "—" : statusLabel}
          </AppText>

          <AppText
            className="text-center text-[11px] text-text-secondary"
            numberOfLines={1}
          >
            {unavailable ? "Hours" : statusDetail}
          </AppText>
        </View>

        {/* Status and distance divider */}
        <View className="my-3 w-px bg-border-primary" />

        {/* Distance summary */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={unavailable ? "Distance unavailable" : undefined}
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="bold"
            className="mt-0.5 text-center text-[13px] text-text-primary"
            numberOfLines={unavailable ? undefined : 1}
          >
            {unavailable ? "—" : (distance ?? "—")}
          </AppText>

          <AppText className="text-[11px] text-text-secondary">
            {unavailable ? "Distance" : distance !== null ? "away" : "distance"}
          </AppText>
        </View>
      </View>
    </View>
  );
}
