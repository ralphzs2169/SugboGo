import { render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import RecentReviewInsightsSection from "../RecentReviewInsightsSection";

const insights: BusinessReviewInsights = {
  state: "ready",
  state_message: "Review insights are ready.",
  content_available: true,
  narrative: "Visitors praise friendly service.",
  review_count: 6,
  eligible_review_count: 5,
  minimum_eligible_review_count: 5,
  analyzed_review_count: 5,
  classified_review_count: 5,
  has_sufficient_sentiment_data: true,
  overall_vibe: "mostly_positive",
  is_sampled: false,
  sentiment: {
    positive: { count: 5, percentage: 100 },
    neutral: { count: 0, percentage: 0 },
    negative: { count: 0, percentage: 0 },
  },
  frequent_mentions: [{ label: "friendly service", count: 3 }],
  coverage_start: null,
  coverage_end: null,
  generated_at: null,
  sentiment_computed_at: null,
  updated_at: null,
};

describe("RecentReviewInsightsSection", () => {
  it("distinguishes an unprocessed summary from zero eligible reviews", async () => {
    const screen = await render(<RecentReviewInsightsSection insights={null} />);
    expect(screen.getByText("Recent insights are not available yet")).toBeTruthy();
    expect(screen.queryByText("No recent insights yet")).toBeNull();
  });

  it("uses recent eligible count and shows ready content", async () => {
    const screen = await render(
      <RecentReviewInsightsSection insights={insights} />,
    );
    expect(
      screen.getByText(
        "Based on 5 eligible reviews from the past 30 days.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Visitors praise friendly service.")).toBeTruthy();
    expect(screen.getByText("Mostly positive")).toBeTruthy();
    expect(screen.getByText("Positive")).toBeTruthy();
  });

  it("keeps a zero recent review state visible", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          eligible_review_count: 0,
          minimum_eligible_review_count: 7,
          content_available: false,
          narrative: null,
          has_sufficient_sentiment_data: false,
        }}
      />,
    );
    expect(screen.getByText("No recent insights yet")).toBeTruthy();
    expect(
      screen.getByText(
        "At least 7 eligible reviews from the past 30 days are needed to generate insights.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Vibe Summary")).toBeNull();
    expect(screen.queryByText("Positive")).toBeNull();
  });

  it("shows insufficient generation while keeping sufficient sentiment", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          state: "insufficient_reviews",
          state_message: "At least five eligible recent reviews are required.",
          eligible_review_count: 4,
          content_available: false,
          narrative: null,
        }}
      />,
    );
    expect(screen.getByText("Not enough recent reviews yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Based on 4 eligible reviews from the past 30 days.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Mostly positive")).toBeTruthy();
    expect(screen.queryByText("Vibe Summary")).toBeNull();
  });

  it("shows generated content without fabricating insufficient sentiment", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          has_sufficient_sentiment_data: false,
          overall_vibe: null,
        }}
      />,
    );
    expect(screen.getByText("Vibe Summary")).toBeTruthy();
    expect(screen.queryByText("Positive")).toBeNull();
  });

  it("shows retained outdated content with its freshness message", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          state: "outdated",
          state_message: "Review insights are outdated and awaiting refresh.",
        }}
      />,
    );
    expect(screen.getByText("Visitors praise friendly service.")).toBeTruthy();
    expect(screen.getByText(/outdated and awaiting refresh/)).toBeTruthy();
  });

  it.each(["pending", "outdated"] as const)(
    "shows updating while %s content is unavailable",
    async (state) => {
      const screen = await render(
        <RecentReviewInsightsSection
          insights={{
            ...insights,
            state,
            state_message: "Recent reviews changed. Refreshing insights.",
            content_available: false,
            narrative: null,
          }}
        />,
      );
      expect(screen.getByText("Updating insights…")).toBeTruthy();
      expect(
        screen.getByText("Recent reviews changed. Refreshing insights."),
      ).toBeTruthy();
      expect(screen.queryByText("Vibe Summary")).toBeNull();
    },
  );

  it("discloses sampling without rendering internal review IDs", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          eligible_review_count: 150,
          analyzed_review_count: 100,
          is_sampled: true,
        }}
      />,
    );
    expect(
      screen.getByText("Based on 100 of 150 eligible recent reviews."),
    ).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain("review_ids");
  });
});
