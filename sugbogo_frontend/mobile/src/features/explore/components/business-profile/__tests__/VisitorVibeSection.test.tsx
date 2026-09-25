import { render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import VisitorVibeSection from "../reviews/VisitorVibeSection";

const insights: BusinessReviewInsights = {
  review_count: 10,
  has_sufficient_sentiment_data: true,
  sentiment: {
    positive: { count: 2, percentage: 66.66666666666666 },
    neutral: { count: 1, percentage: 33.33333333333333 },
    negative: { count: 0, percentage: 0 },
  },
  frequent_mentions: [{ label: "friendly service", count: 3 }],
  updated_at: null,
};

describe("VisitorVibeSection", () => {
  it("renders server sentiment percentages when data is sufficient", async () => {
    const screen = await render(<VisitorVibeSection insights={insights} />);
    expect(screen.getByText("Positive")).toBeTruthy();
    expect(screen.getByText("66.7%")).toBeTruthy();
    expect(screen.getByText("Neutral")).toBeTruthy();
    expect(screen.getByText("33.3%")).toBeTruthy();
  });

  it("does not render when sentiment data is below the threshold", async () => {
    const screen = await render(
      <VisitorVibeSection
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
      const screen = await render(<VisitorVibeSection insights={value} />);
      expect(screen.toJSON()).toBeNull();
    },
  );
});
