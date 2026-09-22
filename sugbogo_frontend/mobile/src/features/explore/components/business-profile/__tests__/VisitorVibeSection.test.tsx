import { render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import VisitorVibeSection from "../VisitorVibeSection";

const insights: BusinessReviewInsights = {
  review_count: 10,
  sentiment: {
    positive: { count: 2, percentage: 66.66666666666666 },
    neutral: { count: 1, percentage: 33.33333333333333 },
    negative: { count: 0, percentage: 0 },
  },
  frequent_mentions: [{ label: "friendly service", count: 3 }],
  updated_at: null,
};

describe("VisitorVibeSection", () => {
  it("renders server percentages and stored theme counts", async () => {
    const screen = await render(<VisitorVibeSection insights={insights} />);
    expect(screen.getByText("66.67% Positive")).toBeTruthy();
    expect(screen.getByText("33.33%")).toBeTruthy();
    expect(
      screen.getByLabelText("friendly service, mentioned in 3 reviews"),
    ).toBeTruthy();
  });

  it("renders sentiment without a themes subsection", async () => {
    const screen = await render(
      <VisitorVibeSection insights={{ ...insights, frequent_mentions: [] }} />,
    );
    expect(screen.getByText("66.67% Positive")).toBeTruthy();
    expect(screen.queryByText("Frequently mentioned")).toBeNull();
  });

  const unclassified = {
    positive: { count: 0, percentage: 0 },
    neutral: { count: 0, percentage: 0 },
    negative: { count: 0, percentage: 0 },
  };

  it("keeps themes visible without a zero sentiment distribution", async () => {
    const screen = await render(
      <VisitorVibeSection
        insights={{ ...insights, sentiment: unclassified }}
      />,
    );
    expect(
      screen.getByLabelText("friendly service, mentioned in 3 reviews"),
    ).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.getByText("Sentiment is not available yet.")).toBeTruthy();
  });

  it.each([
    undefined,
    null,
    { ...insights, sentiment: unclassified, frequent_mentions: [] },
    {
      ...insights,
      review_count: 0,
      sentiment: unclassified,
      frequent_mentions: [],
    },
  ])("omits absent or empty insights (%#)", async (value) => {
    const screen = await render(<VisitorVibeSection insights={value} />);
    expect(screen.toJSON()).toBeNull();
  });
});
