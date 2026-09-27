import { render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import ReviewVibeSection from "../reviews/ReviewVibeSection";

const insights: BusinessReviewInsights = {
  state: "ready",
  state_message: "Review insights are ready.",
  content_available: true,
  narrative: "Friendly visits are common.",
  review_count: 10,
  eligible_review_count: 10,
  analyzed_review_count: 10,
  classified_review_count: 3,
  has_sufficient_sentiment_data: true,
  overall_vibe: "mostly_positive",
  is_sampled: false,
  sentiment: {
    positive: { count: 2, percentage: 66.66666666666666 },
    neutral: { count: 1, percentage: 33.33333333333333 },
    negative: { count: 0, percentage: 0 },
  },
  frequent_mentions: [{ label: "friendly service", count: 3 }],
  coverage_start: null,
  coverage_end: null,
  generated_at: null,
  updated_at: null,
};

describe("ReviewVibeSection", () => {
  it("renders the backend vibe and server sentiment percentages", async () => {
    const screen = await render(<ReviewVibeSection insights={insights} />);
    expect(screen.getByText("Recent Sentiment")).toBeTruthy();
    expect(screen.getByText("Positive")).toBeTruthy();
    expect(screen.getByText("66.7%")).toBeTruthy();
    expect(screen.getByText("2 reviews")).toBeTruthy();
    expect(screen.getByText("Neutral")).toBeTruthy();
    expect(screen.getByText("33.3%")).toBeTruthy();
  });

  it("does not render when sentiment data is below the threshold", async () => {
    const screen = await render(
      <ReviewVibeSection
        insights={{
          ...insights,
          has_sufficient_sentiment_data: false,
        }}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it.each([undefined, null])(
    "omits unavailable insights (%#)",
    async (value) => {
      const screen = await render(<ReviewVibeSection insights={value} />);
      expect(screen.toJSON()).toBeNull();
    },
  );
});
