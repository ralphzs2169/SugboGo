import { act, fireEvent, render, within } from "@testing-library/react-native";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import { DEFAULT_BUSINESS_REVIEW_FILTERS } from "../../../../types/review.types";
import ReviewFiltersSection from "../review-collection/ReviewFiltersSection";

jest.setTimeout(15_000);

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../ReviewFilterBottomSheet", () => ({
  __esModule: true,
  default: () => null,
}));

const insights = {
  review_count: 8,
  has_sufficient_sentiment_data: true,
  sentiment: {
    positive: { count: 5, percentage: 63 },
    neutral: { count: 2, percentage: 25 },
    negative: { count: 1, percentage: 12 },
  },
  frequent_mentions: [
    { label: "Friendly service", count: 8 },
    { label: "Affordable", count: 6 },
  ],
} as BusinessReviewInsights;

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe("ReviewFiltersSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("places Filter before topics and keeps quick filters and sorting visible", async () => {
    const onChange = jest.fn();
    const screen = await render(
      <ReviewFiltersSection
        insights={insights}
        insightsLoading={false}
        insightsError={false}
        onRetryInsights={jest.fn()}
        filters={DEFAULT_BUSINESS_REVIEW_FILTERS}
        onChange={onChange}
        onClear={jest.fn()}
      />,
    );

    const topicButtons = within(
      screen.getByTestId("review-topic-filters"),
    ).getAllByRole("button");
    expect(
      topicButtons.map((button) => button.props.accessibilityLabel),
    ).toEqual([
      "Filter reviews, 0 active filters",
      "Friendly service, mentioned in 8 reviews",
      "Affordable, mentioned in 6 reviews",
    ]);
    expect(screen.getByLabelText("With photos")).toBeTruthy();
    expect(screen.getByLabelText("With reply")).toBeTruthy();
    expect(screen.getByLabelText("Sort by Newest, selected")).toBeTruthy();
    expect(screen.getByLabelText("Sort by Oldest")).toBeTruthy();
    expect(screen.getByLabelText("Sort by Most liked")).toBeTruthy();

    await press(topicButtons[0]);
    expect(presentBottomSheet).toHaveBeenCalledTimes(1);

    await press(topicButtons[1]);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      topic: "Friendly service",
    });
    await press(screen.getByLabelText("With photos"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      hasPhotos: true,
    });
    await press(screen.getByLabelText("Sort by Oldest"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      ordering: "oldest",
    });
  });

  it("keeps topics available when Visitor Vibe is below the threshold", async () => {
    const screen = await render(
      <ReviewFiltersSection
        insights={{
          ...insights,
          has_sufficient_sentiment_data: false,
        }}
        insightsLoading={false}
        insightsError={false}
        onRetryInsights={jest.fn()}
        filters={DEFAULT_BUSINESS_REVIEW_FILTERS}
        onChange={jest.fn()}
        onClear={jest.fn()}
      />,
    );

    expect(screen.queryByText("Positive")).toBeNull();
    expect(
      screen.getByLabelText("Friendly service, mentioned in 8 reviews"),
    ).toBeTruthy();
  });
});
