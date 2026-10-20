import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import ReviewFeedbackDistribution from "@/shared/components/reviews/ReviewFeedbackDistribution";
import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import type { ReviewSentiment } from "../../../types/review.types";

/** Preserves Explorer's recent-feedback eligibility and optional sentiment filtering. */
export default function ReviewVibeSection({
  insights,
  selectedSentiment = null,
  onSentimentPress,
  showDescription = true,
}: {
  insights?: BusinessReviewInsights | null;
  selectedSentiment?: ReviewSentiment | null;
  onSentimentPress?: (sentiment: ReviewSentiment) => void;
  showDescription?: boolean;
}) {
  if (!insights || !insights.has_sufficient_sentiment_data) return null;
  if (!Object.values(insights.sentiment).some((item) => item.percentage > 0))
    return null;
  return (
    <View>
      {/* Explorer retains its existing heading and compact display. */}
      {showDescription && (
        <AppText weight="semibold" className="mb-3 text-sm text-text-primary">
          Recent Sentiment
        </AppText>
      )}
      <ReviewFeedbackDistribution
        compact
        sentiment={insights.sentiment}
        showPercentages
        selectedSentiment={selectedSentiment}
        onSentimentPress={onSentimentPress}
      />
    </View>
  );
}
