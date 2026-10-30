import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessSentimentRating as Rating } from "../../types/businessRating.types";
import {
  businessRatingAccessibilityLabel,
  hasDisplayableBusinessRating,
} from "../../utils/businessRating.utils";
import { usePresentedBusinessRating } from "../../hooks/businessRatingSync";

/**
 * Presents the server's AI sentiment snapshot separately from customer review totals.
 *
 * Reserves the same two-line area for enabled rating states and never fetches data.
 */
export default function BusinessSentimentRating({
  businessId,
  rating,
  compact = false,
  networkError = false,
}: {
  businessId: number;
  rating?: Rating | null;
  compact?: boolean;
  networkError?: boolean;
}) {
  const current = usePresentedBusinessRating(businessId, rating);
  if (!current) return null;
  const available = !networkError && hasDisplayableBusinessRating(current);
  const message = networkError
    ? "Rating could not refresh"
    : current.state === "insufficient_data"
      ? current.contributing_review_count === null
        ? "Not enough scored reviews"
        : `Not enough reviews · ${current.contributing_review_count} scored`
      : current.state === "pending"
        ? current.automatic_updates_enabled
          ? "Rating updating…"
          : "Awaiting recalculation"
        : "Rating unavailable";
  const count = available ? current.contributing_review_count! : null;
  const value = available ? current.value!.toFixed(1) : null;
  const label = networkError
    ? "AI-derived sentiment rating. Rating could not refresh."
    : businessRatingAccessibilityLabel(current);
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={`min-h-12 justify-center gap-1 ${compact ? "mt-2" : "mt-3"}`}
    >
      {/* Rating value or explicit availability state */}
      <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
        <MaterialCommunityIcons
          name="star-outline"
          size={compact ? 14 : 16}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
        <AppText
          weight="semibold"
          className={
            compact
              ? "min-w-0 shrink text-xs text-text-secondary"
              : "min-w-0 shrink text-sm text-text-primary"
          }
        >
          {available ? `${value}/5 · ${count} scored reviews` : message}
        </AppText>
      </View>
      {/* AI and development disclosure */}
      <AppText className="text-[10px] text-text-tertiary">
        AI sentiment{current.experimental ? " · Experimental" : ""}
      </AppText>
    </View>
  );
}
