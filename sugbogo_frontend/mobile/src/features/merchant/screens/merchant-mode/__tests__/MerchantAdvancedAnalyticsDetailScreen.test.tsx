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
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import {
  peerReport,
  storedInsightsReport,
  timingReport,
  recommendationsReport,
  refreshAcknowledgement,
} from "../../../__tests__/merchantAdvancedAnalytics.fixtures";
import MerchantAnalyticsDetailScreen from "../MerchantAnalyticsDetailScreen";
import type { AdvancedPlusDetailKind } from "../../../types/merchantPlusAnalytics.types";
import type { RecommendationState } from "../../../types/merchantAdvancedAnalytics.types";

jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual("../../../__tests__/analyticsSheet.mock")
    .analyticsSheetMock(),
);
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusPeers: jest.fn(),
  getMerchantPlusStoredInsights: jest.fn(),
  getMerchantPlusProfileTiming: jest.fn(),
  getMerchantPlusRecommendations: jest.fn(),
  refreshMerchantPlusRecommendations: jest.fn(),
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

describe("advanced Plus detail integration", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockReset()
      .mockResolvedValue(plusSuccess(plusStatus()));
    jest
      .mocked(service.getMerchantPlusPeers)
      .mockReset()
      .mockResolvedValue(plusSuccess(peerReport()));
    jest
      .mocked(service.getMerchantPlusStoredInsights)
      .mockReset()
      .mockResolvedValue(plusSuccess(storedInsightsReport()));
    jest
      .mocked(service.getMerchantPlusProfileTiming)
      .mockReset()
      .mockResolvedValue(plusSuccess(timingReport()));
    jest
      .mocked(service.getMerchantPlusRecommendations)
      .mockReset()
      .mockResolvedValue(plusSuccess(recommendationsReport()));
    jest
      .mocked(service.refreshMerchantPlusRecommendations)
      .mockReset()
      .mockResolvedValue(plusSuccess(refreshAcknowledgement()));
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });
  const renderDetail = (kind: AdvancedPlusDetailKind) =>
    render(
      <QueryClientProvider client={client}>
        <MerchantAnalyticsDetailScreen kind={kind} initialPeriod="90" />
      </QueryClientProvider>,
    );

  it("loads only peers, preserves valid zeros and respects metric-level suppression", async () => {
    const screen = await renderDetail("peers");
    await screen.findByLabelText("Recorded profile visits, your business: 0");
    expect(
      screen.getByLabelText("Recorded saves, similar businesses: median: 0"),
    ).toBeTruthy();
    expect(
      screen.getByText(/needs more reviews with a sentiment label/),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(/Positive reviews.*similar businesses: median/),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show Plus measurement details" }),
    );
    expect(screen.getByText(/broader business group is used/)).toBeTruthy();
    expect(service.getMerchantPlusStoredInsights).not.toHaveBeenCalled();
    expect(service.getMerchantPlusRecommendations).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() =>
      expect(service.getMerchantPlusPeers).toHaveBeenLastCalledWith(
        { period: "7" },
        expect.anything(),
      ),
    );
  });

  it("withholds an insufficient peer group even if numerical fields were supplied", async () => {
    const report = peerReport();
    report.group.size = 2;
    report.status = "insufficient_data";
    jest
      .mocked(service.getMerchantPlusPeers)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("peers");
    await screen.findByText("Not enough comparable businesses yet");
    expect(
      screen.queryByLabelText(/Recorded profile visits, your business/),
    ).toBeNull();
  });

  it("keeps available peer metrics while exposing Retry for an unavailable source", async () => {
    const report = peerReport();
    report.metrics.profile_visits.status = "unavailable";
    report.metrics.profile_visits.reason = "visibility_unavailable";
    jest
      .mocked(service.getMerchantPlusPeers)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("peers");
    await screen.findByLabelText(
      "Vouches added that still count, your business: 1",
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Some peer comparisons unavailable.*retry/i,
      }),
    );
    await screen.findByLabelText("Recorded profile visits, your business: 0");
  });

  it("uses stored insights' own coverage without a date selector or generation request", async () => {
    const screen = await renderDetail("review-insights");
    await screen.findByText("Stored narrative from eligible reviews.");
    expect(screen.getByText("This summary needs updating")).toBeTruthy();
    expect(screen.getByText(/Based on 6 reviews/)).toBeTruthy();
    expect(screen.getByText(/Sep 10/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Last 90 days" })).toBeNull();
    expect(service.getMerchantPlusStoredInsights).toHaveBeenCalledWith(
      expect.anything(),
    );
    expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/Coffee|Service/).map((item) => item.props.children),
    ).toEqual(["Service", "Coffee"]);
    expect(screen.queryByText(/rolling 30-day generation window/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show review summary details" }),
    );
    expect(screen.getByText(/rolling 30-day generation window/)).toBeTruthy();
    expect(screen.getByText(/Review criteria have changed/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close review summary information" }),
    );
    expect(screen.queryByText(/rolling 30-day generation window/)).toBeNull();
    expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
  });

  it("keeps the review insights header and sheet available during loading", async () => {
    let finish!: (
      value: Awaited<ReturnType<typeof service.getMerchantPlusStoredInsights>>,
    ) => void;
    jest.mocked(service.getMerchantPlusStoredInsights).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await renderDetail("review-insights");
    await screen.findByLabelText("Loading review insights");
    expect(screen.getByRole("header", { name: "Review summary" })).toBeTruthy();
    expect(screen.getByText("Commonly mentioned")).toBeTruthy();
    expect(screen.queryByText("Reporting period")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show review summary details" }),
    );
    expect(screen.getByText("Summary and common mentions")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close review summary information" }),
    );
    await act(async () => finish(plusSuccess(storedInsightsReport())));
    await screen.findByText("Stored narrative from eligible reviews.");
  });

  it("recovers review insights errors without losing cached content", async () => {
    jest.mocked(service.getMerchantPlusStoredInsights).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderDetail("review-insights");
    await screen.findByText("Unable to load review insights");
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to load review insights.*retry/i,
      }),
    );
    await screen.findByText("Stored narrative from eligible reviews.");
    jest.mocked(service.getMerchantPlusStoredInsights).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () =>
      screen
        .getByTestId("advanced-plus-detail-scroll")
        .props.refreshControl.props.onRefresh(),
    );
    await screen.findByText("Unable to refresh review insights");
    expect(
      screen.getByText("Stored narrative from eligible reviews."),
    ).toBeTruthy();
    expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
  });

  it("handles a missing stored summary without fabricating content", async () => {
    const report = storedInsightsReport();
    report.stored_summary = null;
    jest
      .mocked(service.getMerchantPlusStoredInsights)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("review-insights");
    await screen.findByText("No review summary yet");
    expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
  });

  it("withholds gated stored content while retaining sample metadata", async () => {
    const report = storedInsightsReport();
    report.stored_summary!.state = "insufficient_reviews";
    report.stored_summary!.content_available = false;
    jest
      .mocked(service.getMerchantPlusStoredInsights)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("review-insights");
    await screen.findByText("More reviews are needed");
    expect(
      screen.queryByText("Stored narrative from eligible reviews."),
    ).toBeNull();
    expect(screen.queryByText("Coffee")).toBeNull();
    expect(screen.queryByText(/Based on 6 reviews/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show review summary details" }),
    );
    expect(screen.getByText(/Based on 6 of 8 reviews/)).toBeTruthy();
  });

  it("shows all weekdays in a heatmap and inspects exact counts without another request", async () => {
    const screen = await renderDetail("timing");
    await screen.findByLabelText("Timing profile visits: 3");
    expect(
      screen.queryByText(/Plus preview access|Plus demo access/),
    ).toBeNull();
    expect(screen.getByLabelText("Monday, 09:00–10:00: 2")).toBeTruthy();
    expect(screen.getByLabelText("Monday, 08:00–09:00: 0")).toBeTruthy();
    expect(screen.queryByText("— Data unavailable")).toBeNull();
    expect(screen.queryByText("× Outside selected dates")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Tuesday, 10:00–11:00: 1" }),
    );
    expect(screen.getByLabelText("Tuesday, 10:00–11:00: 1")).toBeTruthy();
    expect(
      screen.getByLabelText("Hourly recorded profile visits: 1"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tuesday, 10:00–11:00: 1" }).props
        .className,
    ).toContain("border-text-info");
    expect(screen.getByText("Across this hour on 4 dates")).toBeTruthy();
    expect(service.getMerchantPlusProfileTiming).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("timing-heatmap-scroll").props.horizontal).toBe(
      true,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Close hourly visit details" }),
    );
    expect(
      screen.queryByLabelText("Hourly recorded profile visits: 1"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tuesday, 10:00–11:00: 1" }).props
        .accessibilityState.selected,
    ).toBe(false);
    await fireEvent.press(
      screen.getByRole("button", { name: "Monday, 09:00–10:00: 2" }),
    );
    expect(
      screen.getByLabelText("Hourly recorded profile visits: 2"),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close hourly visit details" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "About visit timing" }),
    );
    expect(screen.getByText(/not physical customer arrivals/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Detailed visit-timing measurements",
      }),
    );
    expect(
      screen.getByText(/cannot reliably identify your busiest hours/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close visit-timing information" }),
    );
    expect(
      screen.queryByText(/cannot reliably identify your busiest hours/),
    ).toBeNull();
  });

  it("keeps timing controls and headings visible during period changes", async () => {
    const screen = await renderDetail("timing");
    await screen.findByLabelText("Timing profile visits: 3");
    let finish!: (
      value: Awaited<ReturnType<typeof service.getMerchantPlusProfileTiming>>,
    ) => void;
    jest.mocked(service.getMerchantPlusProfileTiming).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Change reporting period, currently 90 days",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Last 90 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    expect(screen.getByLabelText("Loading visit timing")).toBeTruthy();
    expect(screen.getByText("Visits by day and hour")).toBeTruthy();
    expect(screen.getByText("Recorded profile visits")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "About visit timing" }),
    ).toBeTruthy();
    await act(async () => finish(plusSuccess(timingReport())));
    await screen.findByLabelText("Timing profile visits: 3");
    expect(
      jest
        .mocked(service.getMerchantPlusProfileTiming)
        .mock.calls.map(([selection]) => selection.period),
    ).toEqual(["90", "7"]);
  });

  it("shows exact partial-hour details without a redundant values list", async () => {
    const screen = await renderDetail("timing");
    await screen.findByLabelText("Timing profile visits: 3");
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Sunday, 23:00–00:00: 0, includes a partial hour",
      }),
    );
    expect(screen.getByText("Across this hour on 4 dates")).toBeTruthy();
    expect(screen.getByText("Includes a partial hour")).toBeTruthy();
    expect(
      screen.getByLabelText("Hourly recorded profile visits: 0"),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close hourly visit details" }),
    );
    expect(
      screen.queryByRole("button", { name: "View exact values" }),
    ).toBeNull();
  });

  it("retries timing failures and keeps cached heatmap data on refresh errors", async () => {
    jest.mocked(service.getMerchantPlusProfileTiming).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderDetail("timing");
    await screen.findByText("Unable to load visit timing");
    expect(
      screen.getByRole("button", { name: "About visit timing" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to load visit timing.*retry/i,
      }),
    );
    await screen.findByLabelText("Timing profile visits: 3");
    jest.mocked(service.getMerchantPlusProfileTiming).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () =>
      screen
        .getByTestId("advanced-plus-detail-scroll")
        .props.refreshControl.props.onRefresh(),
    );
    await screen.findByText("Unable to refresh visit timing");
    expect(screen.getByLabelText("Timing profile visits: 3")).toBeTruthy();
    expect(screen.getByLabelText("Monday, 09:00–10:00: 2")).toBeTruthy();
  });

  it.each(["zero_recorded_visits", "visibility_unavailable"] as const)(
    "keeps %s timing distinct",
    async (state) => {
      const report = timingReport();
      report.display_state = state;
      report.total_profile_visits = state === "zero_recorded_visits" ? 0 : null;
      jest
        .mocked(service.getMerchantPlusProfileTiming)
        .mockResolvedValueOnce(plusSuccess(report));
      const screen = await renderDetail("timing");
      await screen.findByText(
        state === "zero_recorded_visits"
          ? "No recorded profile visits in this period"
          : "Profile-visit timing unavailable",
      );
      expect(
        screen.getByLabelText(
          `Timing profile visits: ${report.total_profile_visits ?? "Unavailable"}`,
        ),
      ).toBeTruthy();
    },
  );

  it("retains outside-period and unavailable hourly cells without replacing either with zero", async () => {
    const report = timingReport();
    report.cells[0] = {
      ...report.cells[0],
      state: "outside_period",
      profile_visits: null,
      period_occurrences: 0,
    };
    report.cells[1] = {
      ...report.cells[1],
      state: "visibility_unavailable",
      profile_visits: null,
    };
    jest
      .mocked(service.getMerchantPlusProfileTiming)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderDetail("timing");
    await screen.findByLabelText("Monday, 00:00–01:00: Outside period");
    expect(screen.getByText("— Data unavailable")).toBeTruthy();
    expect(screen.getByText("× Outside selected dates")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Monday, 00:00–01:00: Outside period",
      }),
    );
    expect(
      screen.getByLabelText("Hourly recorded profile visits: Outside period"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "This weekday and hour fall outside the selected reporting period.",
      ),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close hourly visit details" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Monday, 01:00–02:00: Unavailable" }),
    );
    expect(
      screen.getByLabelText("Hourly recorded profile visits: Unavailable"),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText("Hourly recorded profile visits: 0"),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close hourly visit details" }),
    );
    expect(
      screen.getByLabelText("Monday, 01:00–02:00: Unavailable"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Monday, 09:00–10:00: 2")).toBeTruthy();
  });

  it.each(["NETWORK_ERROR", "RECOMMENDATION_REFRESH_IN_PROGRESS"])(
    "keeps fallback findings after refresh error %s without automatic retry",
    async (code) => {
      jest
        .mocked(service.refreshMerchantPlusRecommendations)
        .mockResolvedValueOnce({
          success: false,
          code,
          message: "Please check the current request state.",
        });
      const screen = await renderDetail("recommendations");
      await screen.findByText("Recommendations not requested");
      await fireEvent.press(
        screen.getByRole("button", { name: "Get recommendations" }),
      );
      await screen.findByText(
        code === "NETWORK_ERROR"
          ? "Unable to request recommendations"
          : "Another request is in progress",
      );
      expect(
        screen.getByText("Published reviews are awaiting a reply."),
      ).toBeTruthy();
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      );
      await fireEvent.press(
        screen.getByRole("button", { name: /Tap to check status/i }),
      );
      await waitFor(() =>
        expect(service.getMerchantPlusRecommendations).toHaveBeenCalledTimes(2),
      );
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      );
    },
  );

  it.each([
    "pending",
    "running",
    "ready",
    "insufficient_data",
    "failed",
    "invalidated",
  ] as RecommendationState[])(
    "renders the backend recommendation lifecycle state %s without auto generation",
    async (state) => {
      jest
        .mocked(service.getMerchantPlusRecommendations)
        .mockResolvedValueOnce(plusSuccess(recommendationsReport(state)));
      const screen = await renderDetail("recommendations");
      const button = await screen.findByRole("button", {
        name: "Update recommendations",
      });
      expect(button.props.accessibilityState.disabled).toBe(
        state === "pending" || state === "running",
      );
      expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
      expect(
        screen.getByText("Published reviews are awaiting a reply."),
      ).toBeTruthy();
      if (state === "ready")
        expect(
          screen.getByText(
            "Review the unanswered published-review backlog and respond where appropriate.",
          ),
        ).toBeTruthy();
      else
        expect(
          screen.queryByText(
            "Review the unanswered published-review backlog and respond where appropriate.",
          ),
        ).toBeNull();
    },
  );

  it("generates only on request, then supports manual status checks and read-only pull refresh", async () => {
    const screen = await renderDetail("recommendations");
    await screen.findByText("Recommendations not requested");
    expect(service.refreshMerchantPlusRecommendations).not.toHaveBeenCalled();
    jest
      .mocked(service.getMerchantPlusRecommendations)
      .mockResolvedValueOnce(plusSuccess(recommendationsReport("pending")));
    await fireEvent.press(
      screen.getByRole("button", { name: "Get recommendations" }),
    );
    await screen.findByText("Recommendations are queued");
    expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledWith({
      period: "90",
    });
    jest
      .mocked(service.getMerchantPlusRecommendations)
      .mockResolvedValue(plusSuccess(recommendationsReport("ready")));
    await fireEvent.press(
      screen.getByRole("button", { name: "Check recommendation status" }),
    );
    await screen.findByText("Recommendations ready");
    await act(async () => {
      await screen
        .getByTestId("advanced-plus-detail-scroll")
        .props.refreshControl.props.onRefresh();
    });
    expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(1);
  });

  it("explains throttling, blocks immediate refresh retries and retains stored findings", async () => {
    jest
      .mocked(service.refreshMerchantPlusRecommendations)
      .mockResolvedValueOnce({
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests.",
        errors: { retry_after: 60 },
      } as never);
    const screen = await renderDetail("recommendations");
    await screen.findByText("Recommendations not requested");
    await fireEvent.press(
      screen.getByRole("button", { name: "Get recommendations" }),
    );
    await screen.findByText("Update limit reached");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Get recommendations" }).props
          .accessibilityState.disabled,
      ).toBe(true),
    );
    expect(
      screen.getByText("Published reviews are awaiting a reply."),
    ).toBeTruthy();
    expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(1);
  });

  it("loads advanced reports without a frontend entitlement guard", async () => {
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockResolvedValueOnce(plusSuccess(plusStatus(false)));
    const screen = await renderDetail("recommendations");
    await screen.findByText("Reply to unanswered reviews");
    expect(service.getMerchantPlusRecommendations).toHaveBeenCalledTimes(1);
    expect(service.getMerchantPlusStatus).not.toHaveBeenCalled();
    expect(screen.queryByText("Report access unavailable")).toBeNull();
  });
});
