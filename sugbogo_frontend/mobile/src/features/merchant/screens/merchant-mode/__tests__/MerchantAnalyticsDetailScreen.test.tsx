import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import * as service from "../../../api/merchantPlusAnalytics.service";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import {
  plusStatus,
  plusSuccess,
  pocketReport,
  reviewReport,
  specialtyReport,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import MerchantAnalyticsDetailScreen from "../MerchantAnalyticsDetailScreen";
import type { PlusDetailKind } from "../../../types/merchantPlusAnalytics.types";

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusPocket: jest.fn(),
  getMerchantPlusSpecialties: jest.fn(),
  getMerchantPlusReviewPerformance: jest.fn(),
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: {
      id: 8,
      specialty_tags: [
        { id: 1, name: "Coffee", color: "purple", icon: "coffee" },
        { id: 2, name: "Friendly service", color: "green", icon: "heart" },
      ],
    },
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 16, left: 0 }),
  };
});
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));

describe("lazy Core Plus detail reports", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockReset()
      .mockResolvedValue(plusSuccess(plusStatus()));
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockReset()
      .mockResolvedValue(plusSuccess(pocketReport()));
    jest
      .mocked(service.getMerchantPlusSpecialties)
      .mockReset()
      .mockResolvedValue(plusSuccess(specialtyReport()));
    jest
      .mocked(service.getMerchantPlusReviewPerformance)
      .mockReset()
      .mockResolvedValue(plusSuccess(reviewReport()));
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });
  const renderDetail = (kind: PlusDetailKind) =>
    render(
      <QueryClientProvider client={client}>
        <MerchantAnalyticsDetailScreen kind={kind} initialPeriod="90" />
      </QueryClientProvider>,
    );

  it("fetches only Pocket detail, preserves distinct savers and exposes explicit zero weeks", async () => {
    const screen = await renderDetail("pocket");
    await screen.findByLabelText("Accounts that saved your business: 3");
    expect(screen.getByLabelText("Recorded saves: 5")).toBeTruthy();
    expect(screen.getByText(/even if it later/)).toBeTruthy();
    expect(service.getMerchantPlusPocket).toHaveBeenCalledWith(
      { period: "90" },
      expect.anything(),
    );
    expect(service.getMerchantPlusSpecialties).not.toHaveBeenCalled();
    expect(service.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show Recorded saves values" }),
    );
    expect(screen.getByText("0")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() =>
      expect(service.getMerchantPlusPocket).toHaveBeenLastCalledWith(
        { period: "7" },
        expect.anything(),
      ),
    );
  });

  it("selects individual specialty cohorts without requesting another report", async () => {
    const screen = await renderDetail("specialties");
    await screen.findByLabelText(
      "Coffee: 2 vouches added in this period that still count, 2 supporting accounts",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Specialty: Friendly service" }),
    );
    expect(
      screen.getByLabelText(
        "Friendly service: 1 vouches added in this period that still count, 1 supporting accounts",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Specialty: Friendly service" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(service.getMerchantPlusSpecialties).toHaveBeenCalledTimes(1);
    expect(service.getMerchantPlusPocket).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show Plus measurement details" }),
    );
    expect(
      screen.getByText(/do not show net growth or past support totals/),
    ).toBeTruthy();
  });

  it("uses backend sentiment percentages and percentage-point reply comparisons", async () => {
    const screen = await renderDetail("reviews");
    await screen.findByLabelText("Reviews replied to: 25%");
    expect(
      screen.getByLabelText(
        "Positive: 2 reviews, 66.67% of reviews with a sentiment label",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Negative: 0 reviews, 0% of reviews with a sentiment label",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/3 with a sentiment label · 1 without a label/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "+25 percentage points compared with reviews from the previous period",
      ),
    ).toBeTruthy();
    expect(screen.getByText("1 hr")).toBeTruthy();
    expect(screen.getByTestId("analytics-sentiment-fill-positive")).toHaveStyle(
      { width: "66.67%" },
    );
    expect(screen.getByTestId("analytics-sentiment-fill-neutral")).toHaveStyle({
      width: "33.33%",
    });
    expect(screen.getByTestId("analytics-sentiment-fill-negative")).toHaveStyle(
      { width: "0%" },
    );
  });

  it("withholds sentiment shares for insufficient samples and preserves zero/null reply measures", async () => {
    const report = reviewReport();
    report.current.has_sufficient_sentiment_data = false;
    report.current.reply_rate = 0;
    report.current.median_first_reply_seconds = null;
    report.current.median_replied_sample_size = 0;
    report.reply_rate_change.value = null;
    report.reply_rate_change.direction = null;
    report.reply_rate_change.reason = "insufficient_sample";
    jest
      .mocked(service.getMerchantPlusReviewPerformance)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("reviews");
    await screen.findByText("More reviews are needed to show a pattern");
    expect(screen.queryByText(/66\.67%/)).toBeNull();
    expect(screen.getByLabelText("Positive: 2 reviews")).toBeTruthy();
    expect(screen.getByLabelText("Reviews replied to: 0%")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Comparison unavailable")).toBeTruthy();
    expect(screen.queryAllByTestId("analytics-sentiment-bar")).toHaveLength(0);
  });

  it("shows a friendly save empty state without a report Retry for legitimate zero activity", async () => {
    const report = pocketReport();
    report.metrics.saves.value = 0;
    report.metrics.saves.series = [];
    report.metrics.distinct_savers.value = 0;
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("pocket");
    await screen.findByText("No recorded activity in this period");
    expect(screen.getByLabelText("Recorded saves: 0")).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts that saved your business: 0"),
    ).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.getByText(/Some activity may not be recorded/)).toBeTruthy();
  });

  it("retains dated saves when the total is unavailable and retries the affected report", async () => {
    const report = pocketReport();
    report.metrics.saves.value = null;
    report.metrics.saves.sources.current.partial_reasons = [
      "total_read_unavailable",
      "coverage_unverified",
    ];
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("pocket");
    await screen.findByLabelText("Recorded saves: Unavailable");
    expect(screen.getByTestId("analytics-chart-viewport")).toBeTruthy();
    expect(screen.getByText(/Some figures could not be loaded/)).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts that saved your business: 3"),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Some recorded activity is unavailable.*retry/i,
      }),
    );
    await screen.findByLabelText("Recorded saves: 5");
  });

  it("does not treat an unavailable report as zero activity", async () => {
    const report = pocketReport();
    report.meta.availability = "unavailable";
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("pocket");
    await screen.findByRole("button", {
      name: /Report data unavailable.*retry/i,
    });
    expect(
      screen.queryByText("No recorded activity in this period"),
    ).toBeNull();
    expect(screen.queryByLabelText("Recorded saves: 5")).toBeNull();
    expect(screen.getByTestId("analytics-chart-empty-state")).toHaveStyle({
      minHeight: 196,
    });
    await fireEvent.press(
      screen.getByRole("button", { name: /Report data unavailable.*retry/i }),
    );
    await screen.findByLabelText("Recorded saves: 5");
  });

  it("shows no qualifying specialty additions while preserving selection", async () => {
    const report = specialtyReport();
    const specialty = report.specialties[0];
    specialty.added_and_still_valid = 0;
    specialty.distinct_supporters = 0;
    specialty.series.forEach((row) => {
      row.added_and_still_valid = 0;
      row.distinct_supporters = 0;
    });
    jest
      .mocked(service.getMerchantPlusSpecialties)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("specialties");
    await screen.findByText("No vouches from these dates still count");
    expect(
      screen.getByLabelText(
        "Coffee: 0 vouches added in this period that still count, 0 supporting accounts",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Specialty: Friendly service" }),
    );
    expect(screen.getByTestId("analytics-column-2026-10-05")).toBeTruthy();
    expect(
      screen.queryByText("No vouches from these dates still count"),
    ).toBeNull();
  });

  it("keeps a single classified review as counts rather than a sentiment conclusion", async () => {
    const report = reviewReport();
    Object.assign(report.current, {
      published_review_count: 1,
      classified_review_count: 1,
      unclassified_review_count: 0,
      has_sufficient_sentiment_data: false,
      reply_rate: 100,
      sentiment: {
        positive: { count: 1, percentage: 100 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 },
      },
    });
    jest
      .mocked(service.getMerchantPlusReviewPerformance)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("reviews");
    await screen.findByText("More reviews are needed to show a pattern");
    expect(screen.getByLabelText("Positive: 1 reviews")).toBeTruthy();
    expect(screen.queryAllByTestId("analytics-sentiment-bar")).toHaveLength(0);
    expect(
      screen.getByText(/This percentage describes one review only/),
    ).toBeTruthy();
    expect(
      screen.getByText(/does not show a typical response time/),
    ).toBeTruthy();
  });

  it("preserves a null sentiment share and a valid zero-second reply median", async () => {
    const report = reviewReport();
    report.current.sentiment.positive.percentage = null;
    report.current.median_first_reply_seconds = 0;
    jest
      .mocked(service.getMerchantPlusReviewPerformance)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("reviews");
    await screen.findByText("0 sec");
    expect(screen.getByLabelText("Positive: 2 reviews")).toBeTruthy();
    expect(screen.getByText(/Share unavailable/)).toBeTruthy();
    expect(screen.getAllByTestId("analytics-sentiment-bar")).toHaveLength(2);
    expect(
      screen.queryByTestId("analytics-sentiment-fill-positive"),
    ).toBeNull();
    expect(screen.getByTestId("analytics-sentiment-fill-negative")).toHaveStyle(
      { width: "0%" },
    );
  });

  it.each([-1, 101, Number.NaN])(
    "retains counts without drawing an invalid sentiment percentage %s",
    async (percentage) => {
      const report = reviewReport();
      report.current.sentiment.positive.percentage = percentage;
      jest
        .mocked(service.getMerchantPlusReviewPerformance)
        .mockResolvedValueOnce(plusSuccess(report));
      const screen = await renderDetail("reviews");
      await screen.findByLabelText("Positive: 2 reviews");
      expect(
        screen.queryByTestId("analytics-sentiment-fill-positive"),
      ).toBeNull();
      expect(screen.getByText(/Share unavailable/)).toBeTruthy();
      expect(
        screen.getByTestId("analytics-sentiment-fill-neutral"),
      ).toHaveStyle({ width: "33.33%" });
    },
  );

  it("shows an empty review volume and null reply rate for an empty published cohort", async () => {
    const report = reviewReport();
    Object.assign(report.current, {
      published_review_count: 0,
      replied_review_count: 0,
      unanswered_cohort_count: 0,
      classified_review_count: 0,
      unclassified_review_count: 0,
      has_sufficient_sentiment_data: false,
      reply_rate: null,
      median_first_reply_seconds: null,
      median_replied_sample_size: 0,
      sentiment: {
        positive: { count: 0, percentage: null },
        neutral: { count: 0, percentage: null },
        negative: { count: 0, percentage: null },
      },
    });
    report.series = [];
    report.reply_rate_change.value = null;
    jest
      .mocked(service.getMerchantPlusReviewPerformance)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("reviews");
    await screen.findByText("No published reviews in this period");
    expect(
      screen.getByLabelText("Reviews replied to: Unavailable"),
    ).toBeTruthy();
    expect(
      screen.getByText(/No published reviews from these dates/),
    ).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
  });

  it("does not fetch any detail when restricted, and retries a failed access check", async () => {
    jest.mocked(service.getMerchantPlusStatus).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderDetail("pocket");
    const retry = await screen.findByRole("button", {
      name: /Unable to check Plus access.*retry/i,
    });
    expect(service.getMerchantPlusPocket).not.toHaveBeenCalled();
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockResolvedValueOnce(plusSuccess(plusStatus(false)));
    await fireEvent.press(retry);
    await screen.findByText("Merchant Plus access required");
    expect(service.getMerchantPlusPocket).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Check access again" }),
    );
    await screen.findByLabelText("Accounts that saved your business: 3");
  });

  it("recovers a report failure and keeps cached data after a failed refresh", async () => {
    jest.mocked(service.getMerchantPlusPocket).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderDetail("pocket");
    await fireEvent.press(
      await screen.findByRole("button", {
        name: /Unable to load this report.*retry/i,
      }),
    );
    await screen.findByLabelText("Recorded saves: 5");
    jest.mocked(service.getMerchantPlusPocket).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await screen
        .getByTestId("plus-detail-scroll")
        .props.refreshControl.props.onRefresh();
    });
    await screen.findByRole("button", {
      name: /Unable to refresh this report.*retry/i,
    });
    expect(screen.getByLabelText("Recorded saves: 5")).toBeTruthy();
  });
});
