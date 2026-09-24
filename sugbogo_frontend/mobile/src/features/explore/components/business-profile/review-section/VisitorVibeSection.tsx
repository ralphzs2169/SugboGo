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
    percentageClassName: "text-success",
  },
  {
    key: "neutral",
    label: "Neutral",
    mascot: MASCOT_FACE_NEUTRAL,
    percentageClassName: "text-text-secondary",
  },
  {
    key: "negative",
    label: "Negative",
    mascot: MASCOT_FACE_NEGATIVE,
    percentageClassName: "text-text-error",
  },
] as const;

/**
 * Displays the stored visitor sentiment breakdown for a business.
 *
 * Uses SugboGo mascot expressions and sentiment-aware percentage colors to
 * present server-provided review sentiment without changing its denominator.
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
    <View className="mb-5 rounded-xl">
      {/* Visitor vibe heading */}
      <View className="gap-1">
        <AppText className="text-xs leading-5 text-text-secondary">
          How explorers felt based on their reviews.
        </AppText>
      </View>

      {/* Sentiment breakdown */}
      <View className="mt-4 flex-row">
        {SENTIMENTS.map(({ key, label, mascot, percentageClassName }) => {
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
                  width: 42,
                  height: 42,
                }}
                contentFit="contain"
                accessible={false}
              />

              <AppText
                weight="bold"
                className={`mt-2 text-lg ${percentageClassName}`}
              >
                {percentage}%
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                {label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
