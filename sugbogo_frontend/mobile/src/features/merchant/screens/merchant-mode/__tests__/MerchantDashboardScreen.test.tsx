import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
  waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  analyticsMerchant,
  analyticsSuccess,
  deferredAnalytics,
  standardAnalyticsMeta,
  standardAnalyticsReport,
  unansweredReviewsSummary,
} from "../../../__tests__/merchantAnalytics.fixtures";
import {
  getMerchantStandardAnalytics,
  getMerchantUnansweredReviews,
} from "../../../api/merchantAnalytics.service";
import { merchantPlusReportKey } from "../../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import MerchantDashboardScreen from "../MerchantDashboardScreen";
import { getMerchantRoutePlanning } from "../../../api/merchantRoutePlanning.service";
import { routePlanningReport } from "../../../__tests__/routePlanningAnalytics.fixtures";
import * as plusService from "../../../api/merchantPlusAnalytics.service";
import {
  pocketReport,
  plusStatus,
  plusSuccess,
  reviewReport,
  specialtyReport,
  visibilityReport,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
jest.mock("../../../components/analytics/AnalyticsExport", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual("../../../__tests__/analyticsSheet.mock")
    .analyticsSheetMock(),
);

const mockNavigate = jest.fn();
const mockPresentInformation = jest.fn();
const mockDismissInformation = jest.fn();
const mockPresentPeriod = jest.fn();
let mockFocused = true;
jest.mock("../../../api/merchantRoutePlanning.service", () => ({
  getMerchantRoutePlanning: jest.fn(),
}));
jest.mock("../../../components/analytics/AnalyticsRoutePlanningSheet", () => ({
  __esModule: true,
  default: function MockRouteSheet({
    sheetRef,
  }: {
    sheetRef: { current: unknown };
  }) {
    const { useImperativeHandle } = jest.requireActual("react");
    useImperativeHandle(sheetRef, () => ({
      present: () => mockPresentInformation("route"),
      dismiss: jest.fn(),
    }));
    return null;
  },
}));
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => ({
  __esModule: true,
  default: function MockPeriodSheet({
    sheetRef,
    options,
    onSelect,
    selectedValue,
  }: {
    sheetRef: { current: unknown };
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
    selectedValue: string;
  }) {
    const { useImperativeHandle } = jest.requireActual("react");
    const { Pressable, Text } = jest.requireActual("react-native");
    useImperativeHandle(sheetRef, () => ({
      present: mockPresentPeriod,
      dismiss: jest.fn(),
    }));
    return options.map((option) => (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityState={{ selected: selectedValue === option.value }}
        onPress={() => onSelect(option.value)}
      >
        <Text>{option.label}</Text>
      </Pressable>
    ));
  },
}));
const mockRefetchProfile = jest.fn();
let mockProfileError: unknown = null;
let mockProfileBusinessId = 8;

jest.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotificationUnreadCount: () => ({ unreadCount: 4 }),
}));

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: {
      id: mockProfileBusinessId,
      display_cover_photo_url: "https://example.com/business-cover.jpg",
      specialty_tags: [
        { id: 2, name: "Friendly service", color: "green", icon: "heart" },
        { id: 1, name: "Coffee", color: "purple", icon: "coffee" },
      ],
    },
    error: mockProfileError,
    refetch: mockRefetchProfile,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, push: mockNavigate }),
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantStandardAnalytics: jest.fn(),
  getMerchantUnansweredReviews: jest.fn(),
}));
jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusVisibility: jest.fn(),
  getMerchantPlusPocket: jest.fn(),
  getMerchantPlusSpecialties: jest.fn(),
  getMerchantPlusReviewPerformance: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: jest.fn(() => null),
}));
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
jest.mock("@/shared/components/Skeleton", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});
jest.mock(
  "../../../components/analytics/AnalyticsVisibilityMeasurementSheet",
  () => ({
    __esModule: true,
    default: function MockVisibilitySheet({
      sheetRef,
    }: {
      sheetRef: { current: unknown };
    }) {
      const { useImperativeHandle } = jest.requireActual("react");
      useImperativeHandle(sheetRef, () => ({
        present: () => mockPresentInformation("visibility"),
        dismiss: () => mockDismissInformation("visibility"),
      }));
      return null;
    },
  }),
);
jest.mock("../../../components/analytics/AnalyitcsMeasurementSheet", () => ({
  __esModule: true,
  default: function MockBusinessSheet({
    sheetRef,
  }: {
    sheetRef: { current: unknown };
  }) {
    const { useImperativeHandle } = jest.requireActual("react");
    useImperativeHandle(sheetRef, () => ({
      present: () => mockPresentInformation("business"),
      dismiss: () => mockDismissInformation("business"),
    }));
    return null;
  },
}));
jest.mock(
  "../../../components/analytics/AnalyticsVisibilityMetricTabs",
  () => ({
    __esModule: true,
    default: ({
      options,
      value,
      onChange,
    }: {
      options: readonly { value: string; label: string }[];
      value: string;
      onChange: (value: string) => void;
    }) => {
      const { View, Pressable, Text } = jest.requireActual("react-native");
      return (
        <View>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: value === option.value }}
              onPress={() => onChange(option.value)}
            >
              <Text>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
  }),
);

const getAnalytics = jest.mocked(getMerchantStandardAnalytics);

jest.setTimeout(15_000);

describe("MerchantDashboardScreen", () => {
  let client: QueryClient;

  beforeEach(() => {
    mockFocused = true;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    getAnalytics.mockReset();
    getAnalytics.mockResolvedValue(analyticsSuccess());
    jest.mocked(getMerchantRoutePlanning).mockReset().mockResolvedValue({
      success: true,
      message: "Success",
      data: routePlanningReport(),
    });
    jest.mocked(getMerchantUnansweredReviews).mockReset().mockResolvedValue({
      success: true,
      message: "Success",
      data: unansweredReviewsSummary(),
    });
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockReset()
      .mockResolvedValue(plusSuccess(plusStatus(false)));
    jest
      .mocked(plusService.getMerchantPlusVisibility)
      .mockReset()
      .mockImplementation(async (_, interval) =>
        plusSuccess(visibilityReport(interval)),
      );
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockReset()
      .mockResolvedValue(plusSuccess(reviewReport()));
    jest
      .mocked(plusService.getMerchantPlusPocket)
      .mockReset()
      .mockResolvedValue(plusSuccess(pocketReport()));
    jest
      .mocked(plusService.getMerchantPlusSpecialties)
      .mockReset()
      .mockResolvedValue(plusSuccess(specialtyReport()));
    mockNavigate.mockClear();
    jest.mocked(Toast.show).mockClear();
    mockRefetchProfile.mockReset();
    mockRefetchProfile.mockResolvedValue({});
    mockProfileError = null;
    mockProfileBusinessId = 8;
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  async function renderScreen() {
    return render(
      <QueryClientProvider client={client}>
        <MerchantDashboardScreen />
      </QueryClientProvider>,
    );
  }

  function sectionPeriodControl(
    screen: Awaited<ReturnType<typeof renderScreen>>,
    title: string,
  ) {
    return within(
      screen.getByRole("header", { name: title }).parent!,
    ).getByRole("button", { name: /Change reporting period/ });
  }

  it("renews the reporting cutoff before comparisons resume on return", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalled(),
    );

    mockFocused = false;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantDashboardScreen />
      </QueryClientProvider>,
    );
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);
    jest.mocked(plusService.getMerchantPlusPocket).mockClear();
    jest.mocked(plusService.getMerchantPlusReviewPerformance).mockClear();

    mockFocused = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantDashboardScreen />
      </QueryClientProvider>,
    );
    expect(plusService.getMerchantPlusPocket).not.toHaveBeenCalled();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
    expect(screen.getByText("Saves")).toBeTruthy();

    const fresh = standardAnalyticsReport();
    fresh.meta.generated_at = new Date(
      Date.parse(fresh.meta.generated_at) + 10 * 60_000,
    ).toISOString();
    await act(async () => pending.resolve(analyticsSuccess(fresh)));

    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalledWith(
        { period: "30", as_of: fresh.meta.generated_at },
        expect.any(AbortSignal),
      ),
    );
    expect(plusService.getMerchantPlusReviewPerformance).toHaveBeenCalledWith(
      { period: "30", as_of: fresh.meta.generated_at },
      expect.any(AbortSignal),
    );
  });

  it("keeps expired comparisons disabled when the return refresh fails", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalled(),
    );
    mockFocused = false;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantDashboardScreen />
      </QueryClientProvider>,
    );
    getAnalytics.mockRejectedValueOnce(new Error("Network unavailable"));
    jest.mocked(plusService.getMerchantPlusPocket).mockClear();
    jest.mocked(plusService.getMerchantPlusReviewPerformance).mockClear();
    mockFocused = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantDashboardScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Unable to refresh analytics")).toBeTruthy();
    expect(screen.getByText("Saves")).toBeTruthy();
    expect(plusService.getMerchantPlusPocket).not.toHaveBeenCalled();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
  });

  it("does not refetch old pinned comparisons during pull-to-refresh", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalled(),
    );
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);
    jest.mocked(plusService.getMerchantPlusPocket).mockClear();
    jest.mocked(plusService.getMerchantPlusReviewPerformance).mockClear();

    await act(async () => {
      screen
        .getByTestId("merchant-dashboard-scroll")
        .props.refreshControl.props.onRefresh();
    });
    expect(plusService.getMerchantPlusPocket).not.toHaveBeenCalled();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();

    const fresh = standardAnalyticsReport();
    fresh.meta.generated_at = "2026-10-17T04:15:00+00:00";
    await act(async () => pending.resolve(analyticsSuccess(fresh)));
    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalledWith(
        { period: "30", as_of: fresh.meta.generated_at },
        expect.any(AbortSignal),
      ),
    );
  });

  it("keeps the current reply backlog independent of period changes and refreshes it on pull", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText("8 published reviews awaiting your reply");
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("7"));
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(1);
    await act(async () => {
      screen
        .getByTestId("merchant-dashboard-scroll")
        .props.refreshControl.props.onRefresh();
    });
    await waitFor(() =>
      expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(2),
    );
  });

  it("recovers the reply backlog independently without losing Standard KPIs", async () => {
    jest.mocked(getMerchantUnansweredReviews).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderScreen();
    const retry = await screen.findByRole("button", {
      name: /Unable to load reviews needing replies.*retry/i,
    });
    expect(screen.getByLabelText(/Profile visits: 24/)).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText("8 published reviews awaiting your reply");
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(2);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it.each([0, null, undefined])(
    "preserves a period vouch count of %s without falling back to the snapshot",
    async (value) => {
      getAnalytics.mockResolvedValueOnce(
        analyticsSuccess(
          standardAnalyticsReport({ vouches_added_and_still_valid: value }),
        ),
      );
      const screen = await renderScreen();
      expect(
        await screen.findByLabelText(
          `Vouches added: ${value === 0 ? "0" : "Unavailable"}. Still valid today`,
        ),
      ).toBeTruthy();
    },
  );

  it("loads a cutoff-aligned retained-vouch badge while preserving the period count", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const standard = standardAnalyticsReport();
    const specialties = specialtyReport();
    specialties.snapshot_as_of = standard.snapshot_as_of;
    specialties.vouches_added_and_still_valid = 3;
    specialties.previous_vouches_added_and_still_valid = 1;
    specialties.vouches_added_change = {
      value: 2,
      direction: "up",
      unit: "count",
      reason: null,
    };
    jest
      .mocked(plusService.getMerchantPlusSpecialties)
      .mockResolvedValue(plusSuccess(specialties));
    const screen = await renderScreen();
    await screen.findByLabelText(
      /Vouches added: 3\. Still valid today\. Increase: \+2 compared with the previous period/,
    );
    expect(plusService.getMerchantPlusSpecialties).toHaveBeenCalledWith(
      { period: "30", as_of: standard.meta.generated_at },
      expect.anything(),
    );
    expect(screen.queryByText("Current vouches")).toBeNull();
  });

  it("hides a cached vouch count when the domain source is unavailable", async () => {
    const report = standardAnalyticsReport();
    report.sources.domain.availability = "unavailable";
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();
    expect(
      await screen.findByLabelText(
        "Vouches added: Unavailable. Still valid today",
      ),
    ).toBeTruthy();
  });

  it("shows only the backend-approved Plus reply-rate change for the matching Standard cohort", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(
        /Review reply rate: 25%\. 1 of 4 reviews.*\+25 pp/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("+25 pp")).toBeTruthy();
    expect(plusService.getMerchantPlusReviewPerformance).toHaveBeenCalledWith(
      { period: "30", as_of: standardAnalyticsMeta().generated_at },
      expect.anything(),
    );
    expect(screen.queryByText(/\+12%|\+3 vs prev/)).toBeNull();
  });

  it("shows an approved absolute review difference using the Standard cutoff", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const report = reviewReport();
    report.published_review_count_change = {
      value: 3,
      direction: "up",
      unit: "count",
      reason: null,
    };
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockResolvedValue(plusSuccess(report));
    const screen = await renderScreen();
    expect(await screen.findByLabelText(/New reviews: 4\..*\+3/)).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("+25 pp")).toBeTruthy();
  });

  it.each([
    { value: -10, direction: "down" as const, label: "−10 pp" },
    { value: 0, direction: "unchanged" as const, label: "No change" },
  ])(
    "shows $direction reply-rate changes in percentage points",
    async (caseValue) => {
      jest
        .mocked(plusService.getMerchantPlusStatus)
        .mockResolvedValue(plusSuccess(plusStatus()));
      const review = reviewReport();
      review.reply_rate_change = {
        value: caseValue.value,
        direction: caseValue.direction,
        unit: "percentage_points",
        reason: null,
      };
      review.previous = {
        ...review.previous,
        published_review_count: caseValue.value < 0 ? 20 : 4,
        replied_review_count: caseValue.value < 0 ? 7 : 1,
        reply_rate: caseValue.value < 0 ? 35 : 25,
      };
      jest
        .mocked(plusService.getMerchantPlusReviewPerformance)
        .mockResolvedValue(plusSuccess(review));
      const screen = await renderScreen();

      expect(
        await screen.findByLabelText(
          new RegExp(
            `^Review reply rate:.*${caseValue.label} compared with the previous period`,
          ),
        ),
      ).toBeTruthy();
    },
  );

  it("keeps a genuine zero reply rate distinct from an unavailable rate", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const standard = standardAnalyticsReport();
    standard.reviews.period_replied_published = 0;
    standard.reviews.reply_rate = 0;
    getAnalytics.mockResolvedValue(analyticsSuccess(standard));
    const review = reviewReport();
    review.current.replied_review_count = 0;
    review.current.reply_rate = 0;
    review.reply_rate_change = {
      value: -25,
      direction: "down",
      unit: "percentage_points",
      reason: null,
    };
    review.previous.reply_rate = 25;
    review.previous.replied_review_count = 1;
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockResolvedValue(plusSuccess(review));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(
        /Review reply rate: 0%\. 0 of 4 reviews.*−25 pp/,
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("analytics-reply-progress")).toBeTruthy();
  });

  it("omits a null or ineligible reply comparison without changing Standard metrics", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const review = reviewReport();
    review.reply_rate_change = {
      value: null,
      direction: null,
      unit: "percentage_points",
      reason: "insufficient_sample",
    };
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockResolvedValue(plusSuccess(review));
    const screen = await renderScreen();

    await waitFor(() =>
      expect(
        client.getQueryState(
          merchantPlusReportKey(42, "reviews", {
            period: "30",
            as_of: standardAnalyticsMeta().generated_at,
          }),
        )?.status,
      ).toBe("success"),
    );
    expect(
      screen.getByLabelText(/Review reply rate: 25%\. 1 of 4/),
    ).toBeTruthy();
    expect(screen.queryByText(/pp$/)).toBeNull();
  });

  it("omits comparisons from a different review cohort", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const review = reviewReport();
    review.current.published_review_count = 5;
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockResolvedValue(plusSuccess(review));
    const screen = await renderScreen();

    await waitFor(() =>
      expect(
        client.getQueryState(
          merchantPlusReportKey(42, "reviews", {
            period: "30",
            as_of: standardAnalyticsMeta().generated_at,
          }),
        )?.status,
      ).toBe("success"),
    );
    expect(
      screen.getByLabelText(/Review reply rate: 25%\. 1 of 4/),
    ).toBeTruthy();
    expect(screen.queryByText(/pp$/)).toBeNull();
  });

  it("keeps Standard cards usable if the optional Plus comparison request fails", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    jest
      .mocked(plusService.getMerchantPlusReviewPerformance)
      .mockResolvedValue({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      });
    const screen = await renderScreen();

    await waitFor(() =>
      expect(
        client.getQueryState(
          merchantPlusReportKey(42, "reviews", {
            period: "30",
            as_of: standardAnalyticsMeta().generated_at,
          }),
        )?.status,
      ).toBe("error"),
    );
    expect(
      screen.getByLabelText(/Review reply rate: 25%\. 1 of 4/),
    ).toBeTruthy();
    expect(screen.queryByText(/pp$/)).toBeNull();
    expect(Toast.show).toHaveBeenCalled();
  });

  it("offers persistent recovery after API errors and uses the page notification hook", async () => {
    getAnalytics.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderScreen();
    const retry = await screen.findByRole("button", {
      name: /Unable to load analytics.*retry/i,
    });

    expect(Toast.show).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/Profile visits: 24/);
    expect(
      screen.queryByRole("button", {
        name: /Unable to load analytics.*retry/i,
      }),
    ).toBeNull();
  });

  it("opens oldest unanswered reviews using the Standard backlog without extra report requests", async () => {
    const screen = await renderScreen();
    const reviews = await screen.findByRole("button", {
      name: "Review oldest unanswered reviews first",
    });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const visibilityRequests = jest.mocked(
      plusService.getMerchantPlusVisibility,
    ).mock.calls.length;
    const pocketRequests = jest.mocked(plusService.getMerchantPlusPocket).mock
      .calls.length;
    const reviewRequests = jest.mocked(
      plusService.getMerchantPlusReviewPerformance,
    ).mock.calls.length;

    await fireEvent.press(reviews);

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(merchant)/(tabs)/reviews",
      params: {
        filter: "needs-reply",
        ordering: "oldest",
        reviewIntent: expect.any(String),
      },
    });
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(
      visibilityRequests,
    );
    expect(plusService.getMerchantPlusPocket).toHaveBeenCalledTimes(
      pocketRequests,
    );
    expect(plusService.getMerchantPlusReviewPerformance).toHaveBeenCalledTimes(
      reviewRequests,
    );
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it("owns the overview and review backlog without loading detailed reports", async () => {
    const screen = await renderScreen();
    await screen.findByTestId("business-overview-grid");
    expect(
      screen.getByRole("header", { name: "Reviews needing replies" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("header", { name: "Visibility trends" }),
    ).toBeNull();
    expect(getMerchantRoutePlanning).not.toHaveBeenCalled();
  });

  it("changes the overview period without filtering the current review backlog", async () => {
    const screen = await renderScreen();
    await screen.findByTestId("business-overview-grid");
    const backlogCalls = jest.mocked(getMerchantUnansweredReviews).mock.calls
      .length;
    await fireEvent.press(sectionPeriodControl(screen, "Business overview"));
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("7"));
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(backlogCalls);
    expect(
      screen.getByLabelText("8 published reviews awaiting your reply"),
    ).toBeTruthy();
  });

  it("keeps the reporting and measurement controls available while loading", async () => {
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValue(pending.promise);
    const screen = await renderScreen();
    expect(screen.getByLabelText("Loading business overview")).toBeTruthy();
    await fireEvent.press(sectionPeriodControl(screen, "Business overview"));
    expect(mockPresentPeriod).toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "How analytics are measured" }),
    );
    expect(mockPresentInformation).toHaveBeenCalledWith("business");
    await act(async () => pending.resolve(analyticsSuccess()));
  });

  it("opens the shared notification inbox from Dashboard", async () => {
    const screen = await renderScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });
});
