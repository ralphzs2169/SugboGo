import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

type FeedbackKind = "positive" | "neutral" | "negative";
type Distribution = Record<
  FeedbackKind,
  { count: number; percentage: number | null }
>;

const CATEGORIES = [
  {
    key: "positive",
    label: "Positive",
    image: require("@/shared/assets/mascot/face/mascot-face-positive.webp"),
    color: "bg-success",
    text: "text-success",
  },
  {
    key: "neutral",
    label: "Neutral",
    image: require("@/shared/assets/mascot/face/mascot-face-neutral.webp"),
    color: "bg-text-secondary",
    text: "text-text-secondary",
  },
  {
    key: "negative",
    label: "Negative",
    image: require("@/shared/assets/mascot/face/mascot-face-negative.webp"),
    color: "bg-text-error",
    text: "text-text-error",
  },
] as const;

/** Shares familiar feedback faces and bars while preserving counts and optional server percentages. */
export default function ReviewFeedbackDistribution({
  sentiment,
  showPercentages,
  compact = false,
  selectedSentiment,
  onSentimentPress,
}: {
  sentiment: Distribution;
  showPercentages: boolean;
  compact?: boolean;
  selectedSentiment?: FeedbackKind | null;
  onSentimentPress?: (sentiment: FeedbackKind) => void;
}) {
  return (
    <View className={compact ? "gap-1.5" : "gap-3"}>
      {CATEGORIES.map(({ key, label, image, color, text }) => {
        const item = sentiment[key];
        const percentage = item.percentage;
        const hasPercentage =
          showPercentages &&
          percentage !== null &&
          Number.isFinite(percentage) &&
          percentage >= 0 &&
          percentage <= 100;
        const formatted = hasPercentage
          ? Number(percentage.toFixed(compact ? 1 : 2))
          : null;
        const countLabel = `${item.count} ${item.count === 1 ? "review" : "reviews"}`;
        const selected = selectedSentiment === key;
        const accessibilityLabel = compact
          ? `${label}${hasPercentage ? `, ${formatted}%` : ""}, ${countLabel}${selected ? ", selected" : ""}`
          : `${label}: ${countLabel}${hasPercentage ? `, ${formatted}% of categorized reviews` : ""}`;
        const content = (
          <View
            className={
              compact ? "flex-row items-center px-2 py-2" : "gap-2 py-1"
            }
          >
            <View
              className={
                compact
                  ? "w-[92px] flex-row items-center"
                  : "flex-row flex-wrap items-center justify-between gap-2"
              }
            >
              <View className="min-w-0 flex-row items-center gap-2">
                <Image
                  source={image}
                  style={{ width: 22, height: 22 }}
                  contentFit="contain"
                  accessible={false}
                />
                <View className="min-w-0">
                  <AppText
                    weight="semibold"
                    className={
                      compact
                        ? "text-xs text-text-primary"
                        : "text-sm text-text-primary"
                    }
                  >
                    {label}
                  </AppText>
                  {compact && (
                    <AppText className="text-[9px] text-text-tertiary">
                      {countLabel}
                    </AppText>
                  )}
                </View>
              </View>
              {!compact && (
                <AppText className="text-sm text-text-secondary">
                  {countLabel}
                  {showPercentages
                    ? hasPercentage
                      ? ` · ${formatted}%`
                      : " · Percentage unavailable"
                    : ""}
                </AppText>
              )}
            </View>
            {hasPercentage && (
              <View
                accessible={false}
                testID="review-feedback-bar"
                className={
                  compact
                    ? "mx-3 h-2 flex-1 overflow-hidden rounded-full bg-gray-200"
                    : "h-2 overflow-hidden rounded-full bg-surface-muted"
                }
              >
                <View
                  testID={`review-feedback-fill-${key}`}
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${percentage}%` }}
                />
              </View>
            )}
            {compact && hasPercentage && (
              <AppText
                weight="bold"
                className={`w-11 text-right text-xs ${text}`}
              >
                {formatted}%
              </AppText>
            )}
          </View>
        );
        return onSentimentPress ? (
          <Pressable
            key={key}
            onPress={() => onSentimentPress(key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={accessibilityLabel}
            className={`cursor-pointer rounded-lg active:opacity-70 ${selected ? "bg-surface-muted-strong" : ""}`}
          >
            {content}
          </Pressable>
        ) : (
          <View
            key={key}
            accessible
            accessibilityLabel={accessibilityLabel}
            className="rounded-lg"
          >
            {content}
          </View>
        );
      })}
    </View>
  );
}
