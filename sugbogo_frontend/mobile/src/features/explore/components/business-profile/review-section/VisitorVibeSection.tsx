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

function formatPercentage(value: number) {
  return Number(value.toFixed(1));
}

/**
 * Displays the stored visitor sentiment distribution for a business.
 *
 * Uses a compact segmented bar for the overall sentiment balance and SugboGo
 * mascot expressions as a restrained legend for each sentiment category.
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
      <View className="mt-3.5 h-2 overflow-hidden rounded-full bg-background">
        <View className="h-full flex-row">
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
      </View>

      {/* Sentiment legend */}
      <View className="mt-4 flex-row rounded-xl bg-background px-2 py-3">
        {SENTIMENTS.map(({ key, label, mascot }, index) => {
          const percentage = formatPercentage(
            insights.sentiment[key].percentage,
          );

          return (
            <View
              key={key}
              accessible
              accessibilityLabel={`${label}, ${percentage}%`}
              className={`flex-1 flex-row items-center justify-center px-2 ${
                index > 0 ? "border-l border-border-primary" : ""
              }`}
            >
              <Image
                source={mascot}
                style={{
                  width: 30,
                  height: 30,
                }}
                contentFit="contain"
                accessible={false}
              />

              <View className="ml-2">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-primary"
                >
                  {label}
                </AppText>

                <AppText className="mt-0.5 text-[11px] text-text-secondary">
                  {percentage}%
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
