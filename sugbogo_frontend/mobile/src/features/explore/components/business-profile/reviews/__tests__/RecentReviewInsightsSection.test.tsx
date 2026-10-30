import { render } from "@testing-library/react-native";

import AppText from "@/shared/components/AppText";

import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../../../types/exploreBusiness.types";
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
  const scheduled: ReviewInsightRegeneration = {
    status: "scheduled",
    is_outstanding: true,
    requested_revision: 2,
    completed_revision: 1,
    run_after: null,
    content_available: true,
    content_is_current: false,
  };

  it.each([
    ["pending", "scheduled", /refresh shortly/],
    ["pending", "processing", /Updating insights with the latest reviews/],
    ["outdated", "retry_wait", /taking longer to update/],
  ] as const)(
    "shows regeneration for %s narrative and %s progress without a distribution",
    async (state, status, message) => {
      const screen = await render(
        <RecentReviewInsightsSection
          insights={{
            ...insights,
            state,
            review_count: 8,
            eligible_review_count: 0,
            content_available: false,
            narrative: null,
            sentiment: {
              positive: { count: 3, percentage: 60 },
              neutral: { count: 1, percentage: 20 },
              negative: { count: 1, percentage: 20 },
            },
          }}
          regeneration={{ ...scheduled, status, content_available: false }}
        />,
      );

      expect(screen.queryByText("Review Insights")).toBeNull();
      expect(screen.queryByText("Positive")).toBeNull();
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.getByTestId("insight-update-status")).toBeTruthy();
      expect(screen.queryByText("No recent insights yet")).toBeNull();
      expect(screen.queryByText("More recent feedback needed")).toBeNull();
      expect(screen.queryByText("Vibe Summary")).toBeNull();
    },
  );

  it.each([
    ["scheduled", /refresh shortly/],
    ["processing", /Updating insights with the latest reviews/],
    ["retry_wait", /taking longer to update/],
  ] as const)(
    "shows subtle %s feedback with retained content",
    async (status, message) => {
      const screen = await render(
        <RecentReviewInsightsSection
          insights={insights}
          regeneration={{ ...scheduled, status }}
        />,
      );
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.getByText(/Showing the previous summary/)).toBeTruthy();
      expect(screen.getByText(insights.narrative!)).toBeTruthy();
      expect(screen.getByTestId("insight-update-status")).toBeTruthy();
    },
  );

  it("uses top-level metadata to hide invalidated content and child mentions", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          regeneration: { ...scheduled, content_available: true },
        }}
        regeneration={{ ...scheduled, content_available: false }}
      >
        <AppText>Generated mentions</AppText>
      </RecentReviewInsightsSection>,
    );
    expect(screen.queryByText(insights.narrative!)).toBeNull();
    expect(screen.queryByText("Generated mentions")).toBeNull();
    expect(screen.queryByText("Positive")).toBeNull();
    expect(screen.queryByText("Review Insights")).toBeNull();
    expect(screen.getByText(/refresh shortly/)).toBeTruthy();
    expect(screen.queryByText("No recent insights yet")).toBeNull();
  });

  it("shows queued feedback with no summary and stops feedback on deterministic completion", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={null}
        regeneration={{ ...scheduled, content_available: false }}
      />,
    );
    expect(screen.getByText(/refresh shortly/)).toBeTruthy();
    await screen.rerender(
      <RecentReviewInsightsSection
        insights={{
          ...insights,
          state: "insufficient_reviews",
          content_available: false,
          narrative: null,
          classified_review_count: 0,
          has_sufficient_sentiment_data: false,
          overall_vibe: null,
        }}
        regeneration={{
          ...scheduled,
          status: "idle",
          is_outstanding: false,
          completed_revision: 2,
          content_available: false,
        }}
      />,
    );
    expect(screen.queryByTestId("insight-update-status")).toBeNull();
    expect(screen.getByText("More recent feedback needed")).toBeTruthy();
  });

  it("displays completed current content without an updating or retained indicator", async () => {
    const screen = await render(
      <RecentReviewInsightsSection
        insights={insights}
        regeneration={{
          ...scheduled,
          status: "idle",
          is_outstanding: false,
          completed_revision: 2,
          content_is_current: true,
        }}
      />,
    );
    expect(screen.getByText(insights.narrative!)).toBeTruthy();
    expect(screen.queryByTestId("insight-update-status")).toBeNull();
    expect(screen.queryByText(/Showing the previous summary/)).toBeNull();
  });

  it("distinguishes an unprocessed summary from zero eligible reviews", async () => {
    const screen = await render(
      <RecentReviewInsightsSection insights={null} />,
    );
    expect(
      screen.getByText("Recent insights are not available yet"),
    ).toBeTruthy();
    expect(screen.queryByText("No recent insights yet")).toBeNull();
  });

  it("uses the eligible population for generated content", async () => {
    const screen = await render(
      <RecentReviewInsightsSection insights={insights} />,
    );
    expect(
      screen.getByText("Based on 5 eligible reviews from the past 30 days."),
    ).toBeTruthy();
    expect(screen.getByText("Visitors praise friendly service.")).toBeTruthy();
    expect(screen.getByText("Mostly positive")).toBeTruthy();
    expect(screen.queryByText("Positive")).toBeNull();
    expect(screen.queryByText("No recent insights yet")).toBeNull();
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

  it("shows insufficient generation independently of sentiment", async () => {
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
    expect(screen.getByText("More recent feedback needed")).toBeTruthy();
    expect(screen.queryByText("Review Insights")).toBeNull();
    expect(screen.getByText("Mostly positive")).toBeTruthy();
    expect(screen.queryByText("Vibe Summary")).toBeNull();
  });

  it.each([
    "no-classifications",
    "below-threshold",
    "empty-distribution",
  ] as const)(
    "does not fabricate sentiment for %s when narrative is unavailable",
    async (reason) => {
      const screen = await render(
        <RecentReviewInsightsSection
          insights={{
            ...insights,
            state: "insufficient_reviews",
            eligible_review_count: 0,
            classified_review_count: reason === "no-classifications" ? 0 : 5,
            has_sufficient_sentiment_data: reason !== "below-threshold",
            content_available: false,
            narrative: null,
            sentiment:
              reason === "empty-distribution"
                ? {
                    positive: { count: 0, percentage: 0 },
                    neutral: { count: 0, percentage: 0 },
                    negative: { count: 0, percentage: 0 },
                  }
                : insights.sentiment,
          }}
          regeneration={{
            ...scheduled,
            status: "idle",
            is_outstanding: false,
            completed_revision: 2,
            content_available: false,
          }}
        />,
      );

      expect(screen.getByText("More recent feedback needed")).toBeTruthy();
      expect(screen.queryByText("Positive")).toBeNull();
      expect(screen.queryByText("Mostly positive")).toBeNull();
      expect(screen.queryByText("Vibe Summary")).toBeNull();
      expect(screen.queryByTestId("insight-update-status")).toBeNull();
    },
  );

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
    expect(screen.getByText("Visitors praise friendly service.")).toBeTruthy();
    expect(screen.queryByText("Mostly positive")).toBeNull();
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
