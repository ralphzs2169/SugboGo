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
    percentageClassName: "text-success",
  },
  {
    key: "neutral",
    label: "Neutral",
    mascot: MASCOT_FACE_NEUTRAL,
    barClassName: "bg-text-secondary",
    percentageClassName: "text-text-secondary",
  },
  {
    key: "negative",
    label: "Negative",
    mascot: MASCOT_FACE_NEGATIVE,
    barClassName: "bg-text-error",
    percentageClassName: "text-text-error",
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

function formatReviewCount(count: number) {
  return `${count} ${count === 1 ? "review" : "reviews"}`;
}

/**
 * Displays a compact recent-sentiment breakdown for a business.
 *
 * Uses individual sentiment bars for easier comparison and supports optional
 * sentiment filtering while preserving backend-provided counts and percentages.
 */
export default function ReviewVibeSection({
  insights,
  selectedSentiment = null,
  onSentimentPress,
  showDescription = true,
}: Props) {
  if (!insights || !insights.has_sufficient_sentiment_data) {
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
      {/* Sentiment heading */}
      {showDescription && (
        <AppText weight="semibold" className="mb-3 text-sm text-text-primary">
          Recent Sentiment
        </AppText>
      )}

      {/* Sentiment distribution rows */}
      <View className="gap-1.5">
        {SENTIMENTS.map(
          ({ key, label, mascot, barClassName, percentageClassName }) => {
            const sentiment = insights.sentiment[key];
            const percentage = formatPercentage(sentiment.percentage);
            const selected = selectedSentiment === key;

            const content = (
              <View className="flex-row items-center px-2 py-2">
                {/* Sentiment identity */}
                <View className="w-[92px] flex-row items-center">
                  <Image
                    source={mascot}
                    style={{
                      width: 22,
                      height: 22,
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

                    <AppText className="text-[9px] text-text-tertiary">
                      {formatReviewCount(sentiment.count)}
                    </AppText>
                  </View>
                </View>

                {/* Sentiment bar */}
                <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  {percentage > 0 && (
                    <View
                      className={`h-full rounded-full ${barClassName}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  )}
                </View>

                {/* Sentiment percentage */}
                <AppText
                  weight="bold"
                  className={`w-11 text-right text-xs ${percentageClassName}`}
                >
                  {percentage}%
                </AppText>
              </View>
            );

            if (!onSentimentPress) {
              return (
                <View
                  key={key}
                  accessible
                  accessibilityLabel={`${label}, ${percentage}%, ${formatReviewCount(
                    sentiment.count,
                  )}`}
                  className="rounded-lg"
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
                accessibilityLabel={`${label}, ${percentage}%, ${formatReviewCount(
                  sentiment.count,
                )}${selected ? ", selected" : ""}`}
                className={`cursor-pointer rounded-lg active:opacity-70 ${
                  selected ? "bg-surface-muted-strong" : ""
                }`}
              >
                {content}
              </Pressable>
            );
          },
        )}
      </View>
    </View>
  );
}
