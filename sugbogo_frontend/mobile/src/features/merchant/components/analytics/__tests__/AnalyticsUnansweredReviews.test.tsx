import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsUnansweredReviews from "../AnalyticsUnansweredReviews";
import { unansweredReviewsSummary } from "../../../__tests__/merchantAnalytics.fixtures";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));

describe("current unanswered review presentation", () => {
  const retry = jest.fn();
  const review = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it("shows exact bucket counts and proportional segments with the oldest-first action", async () => {
    const screen = await render(
      <AnalyticsUnansweredReviews
        data={unansweredReviewsSummary()}
        loading={false}
        error={null}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(
      screen.getByLabelText("8 published reviews waiting for your reply"),
    ).toBeTruthy();
    for (const [key, label, count] of [
      ["under-3", "Under 3 days", 2],
      ["3-to-6", "3–6 days", 3],
      ["7-plus", "7+ days", 3],
    ] as const) {
      expect(screen.getByLabelText(`${label}: ${count} reviews`)).toBeTruthy();
      expect(
        screen.getByTestId(`unanswered-age-segment-${key}`).props.style,
      ).toEqual({ flexGrow: count, flexBasis: 0 });
    }
    await fireEvent.press(
      screen.getByRole("button", { name: "Review oldest first" }),
    );
    expect(review).toHaveBeenCalledTimes(1);
  });

  it("does not allocate a fake segment to a zero bucket", async () => {
    const screen = await render(
      <AnalyticsUnansweredReviews
        data={unansweredReviewsSummary({
          under_3_days: 0,
          days_3_to_6: 0,
          days_7_plus: 1,
          total_unanswered: 1,
        })}
        loading={false}
        error={null}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(screen.queryByTestId("unanswered-age-segment-under-3")).toBeNull();
    expect(screen.getByLabelText("Under 3 days: 0 reviews")).toBeTruthy();
    expect(
      screen.getByTestId("unanswered-age-segment-7-plus").props.style.flexGrow,
    ).toBe(1);
  });

  it("renders a compact genuine-zero completion without Retry or navigation", async () => {
    const screen = await render(
      <AnalyticsUnansweredReviews
        data={unansweredReviewsSummary({
          total_unanswered: 0,
          under_3_days: 0,
          days_3_to_6: 0,
          days_7_plus: 0,
        })}
        loading={false}
        error={null}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(screen.getByText(/All caught up/)).toBeTruthy();
    expect(
      screen.getByLabelText("0 published reviews waiting for your reply"),
    ).toBeTruthy();
    expect(screen.queryByTestId("unanswered-age-segment-under-3")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has an independent initial skeleton and a persistent retryable request error", async () => {
    const screen = await render(
      <AnalyticsUnansweredReviews
        loading
        error={null}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(
      screen.getByLabelText("Loading reviews needing replies"),
    ).toBeTruthy();
    await screen.rerender(
      <AnalyticsUnansweredReviews
        loading={false}
        error={new Error("Offline")}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(screen.queryByText(/All caught up/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to load reviews needing replies.*retry/i,
      }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps usable cached counts during refresh errors", async () => {
    const screen = await render(
      <AnalyticsUnansweredReviews
        data={unansweredReviewsSummary()}
        loading={false}
        error={new Error("Offline")}
        onRetry={retry}
        onReview={review}
      />,
    );
    expect(
      screen.getByLabelText("8 published reviews waiting for your reply"),
    ).toBeTruthy();
    expect(
      screen.getByText("Previously loaded counts are still shown."),
    ).toBeTruthy();
  });
});
