import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { BusinessReviewInsights } from "../../types/exploreBusiness.types";
import BusinessProfileSection from "./BusinessProfileSection";

const SENTIMENTS = [
  { key: "positive", label: "Positive", color: "bg-success" },
  { key: "neutral", label: "Neutral", color: "bg-text-secondary" },
  { key: "negative", label: "Negative", color: "bg-text-error" },
] as const;

/**
 * Displays stored review sentiment and themes within the business profile.
 * Omits empty insights and uses server percentages without changing their denominator.
 */
export default function VisitorVibeSection({
  insights,
}: {
  insights?: BusinessReviewInsights | null;
}) {
  if (!insights) return null;

  const hasSentiment = SENTIMENTS.some(
    ({ key }) => insights.sentiment[key].percentage > 0,
  );
  const hasMentions = insights.frequent_mentions.length > 0;

  if (!hasSentiment && !hasMentions) return null;

  return (
    <BusinessProfileSection title="Visitor Vibe">
      {/* Classified sentiment */}
      {hasSentiment ? (
        <View className="gap-3">
          <AppText weight="bold" className="text-lg text-text-primary">
            {`${Number(insights.sentiment.positive.percentage.toFixed(2))}% Positive`}
          </AppText>
          <AppText className="text-sm text-text-secondary">
            Based on reviews with classified sentiment.
          </AppText>
          {SENTIMENTS.map(({ key, label, color }) => (
            <View key={key} className="gap-2">
              <View className="flex-row justify-between gap-3">
                <AppText className="text-sm text-text-primary">{label}</AppText>
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {Number(insights.sentiment[key].percentage.toFixed(2))}%
                </AppText>
              </View>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-2 overflow-hidden rounded-full bg-background"
              >
                <View
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${insights.sentiment[key].percentage}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <AppText className="text-sm text-text-secondary">
          Sentiment is not available yet.
        </AppText>
      )}

      {/* Stored review themes */}
      {hasMentions && (
        <View className="mt-5 gap-3">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Frequently mentioned
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {insights.frequent_mentions.map((mention) => (
              <View
                key={mention.label}
                className="max-w-full rounded-tag bg-background px-3 py-2"
              >
                <AppText
                  accessibilityLabel={`${mention.label}, mentioned in ${mention.count} ${mention.count === 1 ? "review" : "reviews"}`}
                  className="text-sm text-text-secondary"
                >
                  {mention.label} · {mention.count}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      )}
    </BusinessProfileSection>
  );
}
