import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import colors from "tailwindcss/colors";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessSentimentRating as Rating } from "../../types/businessRating.types";
import {
  businessRatingAccessibilityLabel,
  businessRatingValueAccessibilityLabel,
  hasDisplayableBusinessRating,
} from "../../utils/businessRating.utils";
import { usePresentedBusinessRating } from "../../hooks/businessRatingSync";

/**
 * Presents guarded business ratings in card, stat, header, or expanded formats without fetching.
 * Card ratings yield their announcement to the enclosing profile button.
 */
export default function BusinessSentimentRating({
  businessId,
  rating,
  compact = false,
  networkError = false,
  variant,
  accessible = true,
}: {
  businessId: number;
  rating?: Rating | null;
  compact?: boolean;
  networkError?: boolean;
  variant?: "stat" | "inline" | "header";
  accessible?: boolean;
}) {
  const current = usePresentedBusinessRating(businessId, rating);
  if (!current) return null;
  const available = !networkError && hasDisplayableBusinessRating(current);
  const count = available ? current.contributing_review_count! : null;
  const value = available ? current.value!.toFixed(1) : null;
  const label = networkError
    ? "AI-derived sentiment rating. Rating could not refresh."
    : variant
      ? businessRatingValueAccessibilityLabel(current)
      : businessRatingAccessibilityLabel(current);

  if (compact || variant) {
    if (!available) return null;
    return (
      <View
        accessible={accessible}
        accessibilityLabel={accessible ? label : undefined}
        importantForAccessibility={accessible ? undefined : "no"}
        className={`${compact ? "mt-2 min-w-0" : "shrink-0"} flex-row items-center gap-1`}
      >
        {/* Available rating metadata */}
        <MaterialCommunityIcons
          name="star"
          size={variant === "stat" || variant === "header" ? 18 : 14}
          color={colors.amber[500]}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <AppText
          accessible={accessible ? undefined : false}
          weight="bold"
          className={`min-w-0 shrink text-text-primary ${
            variant === "header"
              ? "text-base"
              : variant === "stat"
                ? "text-[13px]"
                : "text-xs"
          }`}
          numberOfLines={1}
        >
          {value}
          {compact && (
            <AppText
              accessible={accessible ? undefined : false}
              className="text-xs text-text-secondary"
            >
              {" "}
              ({count})
            </AppText>
          )}
        </AppText>
      </View>
    );
  }

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
  return (
    <View
      accessible
      accessibilityLabel={label}
      className="mt-3 min-h-12 justify-center gap-1"
    >
      {/* Rating value or explicit availability state */}
      <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
        <MaterialCommunityIcons
          name="star-outline"
          size={16}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
        <AppText
          weight="semibold"
          className="min-w-0 shrink text-sm text-text-primary"
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
