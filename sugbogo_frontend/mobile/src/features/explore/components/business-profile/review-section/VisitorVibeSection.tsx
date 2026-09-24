import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";

const MASCOT_FACE_POSITIVE = require("@/shared/assets/mascot/face/mascot-face-positive.webp");
const MASCOT_FACE_NEUTRAL = require("@/shared/assets/mascot/face/mascot-face-neutral.webp");
const MASCOT_FACE_NEGATIVE = require("@/shared/assets/mascot/face/mascot-face-negative.webp");

const SENTIMENTS = [
  {
    key: "positive",
    label: "Positive",
    mascot: MASCOT_FACE_POSITIVE,
    barClassName: "bg-success",
  },
  {
    key: "neutral",
    label: "Neutral",
    mascot: MASCOT_FACE_NEUTRAL,
    barClassName: "bg-text-secondary",
  },
  {
    key: "negative",
    label: "Negative",
    mascot: MASCOT_FACE_NEGATIVE,
    barClassName: "bg-text-error",
  },
] as const;

/**
 * Displays the stored visitor sentiment breakdown for a business.
 *
 * Summarizes review sentiment through a single segmented distribution bar and
 * uses SugboGo mascot expressions as a compact legend for each sentiment type.
 */
export default function VisitorVibeSection({
  insights,
}: {
  insights?: BusinessReviewInsights | null;
}) {
  if (!insights) {
    return null;
  }

  const hasSentiment = SENTIMENTS.some(
    ({ key }) => insights.sentiment[key].percentage > 0,
  );

  if (!hasSentiment) {
    return null;
  }

  return (
    <View className="mb-5">
      {/* Sentiment context */}
      <AppText className="text-xs leading-5 text-text-secondary">
        How explorers felt based on their reviews.
      </AppText>

      {/* Sentiment distribution */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mt-4 h-3 flex-row overflow-hidden rounded-full bg-background"
      >
        {SENTIMENTS.map(({ key, barClassName }) => {
          const percentage = insights.sentiment[key].percentage;

          if (percentage <= 0) {
            return null;
          }

          return (
            <View
              key={key}
              className={`h-full ${barClassName}`}
              style={{
                width: `${percentage}%`,
              }}
            />
          );
        })}
      </View>

      {/* Sentiment legend */}
      <View className="mt-4 flex-row">
        {SENTIMENTS.map(({ key, label, mascot }) => {
          const percentage = Number(
            insights.sentiment[key].percentage.toFixed(2),
          );

          return (
            <View
              key={key}
              accessible
              accessibilityLabel={`${label}, ${percentage}%`}
              className="flex-1 items-center"
            >
              <Image
                source={mascot}
                style={{
                  width: 36,
                  height: 36,
                }}
                contentFit="contain"
                accessible={false}
              />

              <AppText
                weight="semibold"
                className="mt-1.5 text-xs text-text-primary"
              >
                {label}
              </AppText>

              <AppText className="mt-0.5 text-[11px] text-text-secondary">
                {percentage}%
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
