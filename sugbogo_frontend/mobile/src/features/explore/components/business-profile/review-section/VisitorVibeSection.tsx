import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import type { ReviewSentiment } from "../../../types/review.types";

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

type Props = {
  insights?: BusinessReviewInsights | null;
  selectedSentiment?: ReviewSentiment | null;
  onSentimentPress?: (sentiment: ReviewSentiment) => void;
  showDescription?: boolean;
};

function formatPercentage(value: number) {
  return Number(value.toFixed(1));
}

/**
 * Displays the stored visitor sentiment distribution for a business.
 *
 * Supports both a read-only summary and an interactive sentiment selector
 * while preserving the server-provided sentiment percentages.
 */
export default function VisitorVibeSection({
  insights,
  selectedSentiment = null,
  onSentimentPress,
  showDescription = true,
}: Props) {
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
    <View>
      {/* Sentiment context */}
      {showDescription && (
        <AppText className="text-xs leading-5 text-text-secondary">
          How explorers felt based on their reviews.
        </AppText>
      )}

      {/* Sentiment distribution */}
      <View
        className={`h-2 overflow-hidden rounded-full bg-background ${
          showDescription ? "mt-3.5" : ""
        }`}
      >
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
          const selected = selectedSentiment === key;

          const content = (
            <>
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
                  className={
                    selected
                      ? "text-xs text-brand"
                      : "text-xs text-text-primary"
                  }
                >
                  {label}
                </AppText>

                <AppText
                  className={
                    selected
                      ? "mt-0.5 text-[11px] text-brand"
                      : "mt-0.5 text-[11px] text-text-secondary"
                  }
                >
                  {percentage}%
                </AppText>
              </View>
            </>
          );

          const containerClassName = `min-w-0 flex-1 flex-row items-center justify-center px-2 ${
            index > 0 ? "border-l border-border-primary" : ""
          }`;

          if (!onSentimentPress) {
            return (
              <View
                key={key}
                accessible
                accessibilityLabel={`${label}, ${percentage}%`}
                className={containerClassName}
              >
                {content}
              </View>
            );
          }

          return (
            <Pressable
              key={key}
              onPress={() => onSentimentPress(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}, ${percentage}%${
                selected ? ", selected" : ""
              }`}
              className={`${containerClassName} cursor-pointer rounded-lg py-1 active:opacity-70 ${
                selected ? "bg-brand/10" : ""
              }`}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
