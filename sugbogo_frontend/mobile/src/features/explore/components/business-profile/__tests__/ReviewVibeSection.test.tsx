import { render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import ReviewVibeSection from "../reviews/ReviewVibeSection";

const insights: BusinessReviewInsights = {
  review_count: 10,
  has_sufficient_sentiment_data: true,
  overall_vibe: "mostly_positive",
  sentiment: {
    positive: { count: 2, percentage: 66.66666666666666 },
    neutral: { count: 1, percentage: 33.33333333333333 },
    negative: { count: 0, percentage: 0 },
  },
  frequent_mentions: [{ label: "friendly service", count: 3 }],
  updated_at: null,
};

describe("ReviewVibeSection", () => {
  it("renders the backend vibe and server sentiment percentages", async () => {
    const screen = await render(<ReviewVibeSection insights={insights} />);
    expect(screen.getByText("Review Vibe")).toBeTruthy();
    expect(screen.getByText("Mostly positive")).toBeTruthy();
    expect(screen.getByText("Positive")).toBeTruthy();
    expect(screen.getByText("66.7%")).toBeTruthy();
    expect(screen.getByText("Neutral")).toBeTruthy();
    expect(screen.getByText("33.3%")).toBeTruthy();
  });

  it.each([
    ["mostly_positive", "Mostly positive", "bg-success", "text-white"],
    [
      "mostly_neutral",
      "Mostly neutral",
      "bg-surface-muted",
      "text-text-secondary",
    ],
    [
      "mostly_negative",
      "Mostly negative",
      "bg-error",
      "text-text-error",
    ],
    ["mixed", "Mixed", "bg-surface-muted", "text-text-secondary"],
  ] as const)(
    "renders %s using its semantic treatment",
    async (overallVibe, label, containerClass, textClass) => {
      const screen = await render(
        <ReviewVibeSection
          insights={{
            ...insights,
            overall_vibe: overallVibe,
          }}
        />,
      );

      expect(screen.getByText(label).props.className).toContain(textClass);
      expect(
        screen.getByTestId("overall-review-vibe").props.className,
      ).toContain(containerClass);
    },
  );

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
