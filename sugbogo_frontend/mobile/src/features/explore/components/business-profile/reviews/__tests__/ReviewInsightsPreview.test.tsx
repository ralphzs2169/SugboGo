import { render } from "@testing-library/react-native";

import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../../../types/exploreBusiness.types";
import ReviewInsightsPreview from "../review-preview-section/ReviewInsightsPreview";

const insights: BusinessReviewInsights = {
  state: "ready",
  state_message: null,
  content_available: true,
  narrative: "Visitors praise friendly service.",
  review_count: 5,
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
  frequent_mentions: [],
  coverage_start: null,
  coverage_end: null,
  generated_at: null,
  sentiment_computed_at: null,
  updated_at: null,
};

describe("ReviewInsightsPreview", () => {
  const scheduled: ReviewInsightRegeneration = {
    status: "scheduled",
    is_outstanding: true,
    requested_revision: 2,
    completed_revision: 1,
    run_after: null,
    content_available: false,
    content_is_current: false,
  };

  it.each(["mostly_positive", "mostly_negative", "mixed"] as const)(
    "keeps the narrative without the %s label",
    async (overall_vibe) => {
      const screen = await render(
        <ReviewInsightsPreview insights={{ ...insights, overall_vibe }} />,
      );
      expect(screen.getByText(insights.narrative!)).toBeTruthy();
      expect(screen.queryByText(/Mostly positive|Mostly negative|Mixed/)).toBeNull();
      expect(screen.queryByTestId("summary-overall-review-vibe")).toBeNull();
    },
  );

  it.each([
    ["scheduled", /refresh shortly/],
    ["processing", /Updating insights with the latest reviews/],
    ["retry_wait", /taking longer to update/],
  ] as const)("shows %s work without an old summary", async (status, message) => {
    const screen = await render(
      <ReviewInsightsPreview
        insights={null}
        regeneration={{ ...scheduled, status }}
      />,
    );
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/Showing the previous summary/)).toBeNull();
  });

  it("shows pending work after publication restores eligibility from four to five", async () => {
    const insufficient: BusinessReviewInsights = {
      ...insights,
      state: "insufficient_reviews",
      eligible_review_count: 4,
      content_available: false,
      narrative: null,
    };
    const screen = await render(
      <ReviewInsightsPreview insights={insufficient} />,
    );
    // A private submission does not change the authoritative eligible population.
    expect(screen.toJSON()).toBeNull();
    await screen.rerender(
      <ReviewInsightsPreview
        insights={{ ...insufficient, eligible_review_count: 5 }}
        regeneration={scheduled}
      />,
    );
    expect(screen.getByText(/refresh shortly/)).toBeTruthy();
    expect(screen.queryByText(insights.narrative!)).toBeNull();
  });
  it.each<BusinessReviewInsights | null>([
    null,
    { ...insights, state: "insufficient_reviews" },
    { ...insights, eligible_review_count: 0 },
    {
      ...insights,
      state: "pending",
      content_available: false,
      narrative: null,
    },
    { ...insights, state: "outdated", content_available: false },
  ])("hides states without usable evidence or a summary: %j", async (value) => {
    const screen = await render(<ReviewInsightsPreview insights={value} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("omits the insufficient-insights message from the profile preview", async () => {
    const screen = await render(
      <ReviewInsightsPreview
        insights={{
          ...insights,
          state: "insufficient_reviews",
          content_available: false,
          narrative: null,
          minimum_eligible_review_count: 7,
        }}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it("keeps an available summary during regeneration but hides invalidated content", async () => {
    const regeneration = {
      status: "processing" as const,
      is_outstanding: true,
      requested_revision: 2,
      completed_revision: 1,
      run_after: null,
      content_available: true,
      content_is_current: false,
    };
    const screen = await render(
      <ReviewInsightsPreview insights={insights} regeneration={regeneration} />,
    );
    expect(screen.getByText(insights.narrative!)).toBeTruthy();
    expect(screen.getByText(/Showing the previous summary/)).toBeTruthy();
    expect(
      screen.getByText(/Updating insights with the latest reviews/),
    ).toBeTruthy();

    await screen.rerender(
      <ReviewInsightsPreview
        insights={insights}
        regeneration={{ ...regeneration, content_available: false }}
      />,
    );
    expect(screen.queryByText(insights.narrative!)).toBeNull();
    expect(screen.getByText(/Updating insights with the latest reviews/)).toBeTruthy();
    expect(screen.queryByText(/Showing the previous summary/)).toBeNull();
  });
});
