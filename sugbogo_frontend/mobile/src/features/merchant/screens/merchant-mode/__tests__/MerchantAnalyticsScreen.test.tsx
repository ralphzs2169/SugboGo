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
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
import {
  merchantPlusReportKey,
  merchantPlusStatusKey,
} from "../../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import MerchantAnalyticsScreen from "../MerchantAnalyticsScreen";
import { getMerchantRoutePlanning } from "../../../api/merchantRoutePlanning.service";
import { routePlanningReport } from "../../../__tests__/routePlanningAnalytics.fixtures";
import * as plusService from "../../../api/merchantPlusAnalytics.service";
import {
  pocketReport,
  plusStatus,
  plusSuccess,
  reviewReport,
  visibilityReport,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";

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

describe("MerchantAnalyticsScreen", () => {
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
        <MerchantAnalyticsScreen />
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

  async function chooseSectionPeriod(
    screen: Awaited<ReturnType<typeof renderScreen>>,
    title: string,
    days: "7" | "30" | "90",
  ) {
    await fireEvent.press(sectionPeriodControl(screen, title));
    await fireEvent.press(
      screen.getByRole("button", { name: `Last ${days} days` }),
    );
  }

  function allowCachedPlusAccess() {
    const status = plusStatus();
    client.setQueryData(merchantPlusStatusKey(42), status);
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(status));
  }

  it("targets independent periods through one sheet and refreshes each active dataset", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(
      screen.getAllByRole("button", {
        name: "Change reporting period, currently 30 days",
      }),
    ).toHaveLength(3);

    await chooseSectionPeriod(screen, "Business overview", "7");
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("7"));
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(1);

    await fireEvent.press(sectionPeriodControl(screen, "Visibility trends"));
    expect(
      screen.getByRole("button", { name: "Last 30 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "90" },
        "weekly",
        expect.any(AbortSignal),
      ),
    );
    expect(getAnalytics).toHaveBeenCalledTimes(2);
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(1);

    await chooseSectionPeriod(screen, "Route-planning activity", "7");
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
        "7",
        expect.any(AbortSignal),
      ),
    );
    expect(
      sectionPeriodControl(screen, "Business overview").props
        .accessibilityLabel,
    ).toContain("7 days");
    expect(
      sectionPeriodControl(screen, "Visibility trends").props
        .accessibilityLabel,
    ).toContain("90 days");
    expect(
      sectionPeriodControl(screen, "Route-planning activity").props
        .accessibilityLabel,
    ).toContain("7 days");
    expect(getAnalytics).toHaveBeenCalledTimes(2);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(2);
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Total vouches: 8.*Current/)).toBeTruthy();
    expect(
      screen.getByLabelText("8 published reviews waiting for your reply"),
    ).toBeTruthy();

    for (const [title, selected] of [
      ["Visibility trends", "90"],
      ["Business overview", "7"],
      ["Route-planning activity", "7"],
    ] as const) {
      await fireEvent.press(sectionPeriodControl(screen, title));
      expect(
        screen.getByRole("button", { name: `Last ${selected} days` }).props
          .accessibilityState.selected,
      ).toBe(true);
      await fireEvent.press(
        screen.getByRole("button", { name: `Last ${selected} days` }),
      );
    }
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const previousCounts = [
      getAnalytics.mock.calls.length,
      jest.mocked(plusService.getMerchantPlusVisibility).mock.calls.length,
      jest.mocked(getMerchantRoutePlanning).mock.calls.length,
    ];
    await act(async () => {
      screen
        .getByTestId("merchant-analytics-scroll")
        .props.refreshControl.props.onRefresh();
    });
    await waitFor(() => {
      expect(getAnalytics).toHaveBeenCalledTimes(previousCounts[0] + 1);
      expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(
        previousCounts[1] + 1,
      );
      expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(
        previousCounts[2] + 1,
      );
    });
    expect(getAnalytics).toHaveBeenLastCalledWith("7");
    expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
      { period: "90" },
      "weekly",
      expect.any(AbortSignal),
    );
    expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
      "7",
      expect.any(AbortSignal),
    );
  });

  it("reuses fresh visibility and route periods without fetching unrelated datasets", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    for (const days of ["90", "30", "90"] as const) {
      await chooseSectionPeriod(screen, "Visibility trends", days);
      await waitFor(() => expect(client.isFetching()).toBe(0));
    }
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(2);
    for (const days of ["7", "30", "7"] as const) {
      await chooseSectionPeriod(screen, "Route-planning activity", days);
      await waitFor(() => expect(client.isFetching()).toBe(0));
    }
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(2);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Loading activity")).toBeNull();
    expect(
      screen.queryByLabelText("Loading route-planning activity"),
    ).toBeNull();
  });

  it("loads visibility independently while the overview and route values remain usable", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    let finish!: (
      response: Awaited<
        ReturnType<typeof plusService.getMerchantPlusVisibility>
      >,
    ) => void;
    jest.mocked(plusService.getMerchantPlusVisibility).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await chooseSectionPeriod(screen, "Visibility trends", "90");
    expect(screen.getByText("Loading visibility activity…")).toBeTruthy();
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
    expect(
      screen.getByLabelText(/Route-planning method breakdown/),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Loading activity")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "About visibility trends" }),
    );
    expect(mockPresentInformation).toHaveBeenCalledWith("visibility");
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(1);
    await act(async () => finish(plusSuccess(visibilityReport("weekly"))));
  });

  it("loads route planning independently while the overview and visibility retain their periods", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    let finish!: (
      response: Awaited<ReturnType<typeof getMerchantRoutePlanning>>,
    ) => void;
    jest.mocked(getMerchantRoutePlanning).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await chooseSectionPeriod(screen, "Route-planning activity", "7");
    expect(
      screen.getByLabelText("Loading route-planning activity"),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
    expect(screen.queryByText("Loading visibility activity…")).toBeNull();
    expect(screen.queryByLabelText("Loading activity")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "About route-planning activity" }),
    );
    expect(mockPresentInformation).toHaveBeenCalledWith("route");
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(1);
    await act(async () =>
      finish({
        success: true,
        message: "Success",
        data: routePlanningReport(),
      }),
    );
  });

  it("does not dismiss unopened measurement sheets when reporting controls change", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/Recorded profile visits: 24/);
    expect(mockPresentInformation).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("7"));
    await fireEvent.press(screen.getByRole("tab", { name: "Impressions" }));
    await fireEvent.press(screen.getByLabelText("Group by weekly"));

    // Gorhom 5.2.14 can remain stuck if dismiss precedes its first present.
    expect(mockDismissInformation).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "How analytics are measured",
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "About visibility trends",
      }),
    );
    expect(mockPresentInformation.mock.calls).toEqual([
      ["business"],
      ["visibility"],
    ]);
  });

  it("keeps all activity header controls usable during initial skeleton loading", async () => {
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValue(pending.promise);
    jest
      .mocked(plusService.getMerchantPlusVisibility)
      .mockReturnValue(new Promise(() => {}));
    jest
      .mocked(getMerchantRoutePlanning)
      .mockReturnValue(new Promise(() => {}));
    const screen = await renderScreen();

    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    const controls = screen.getAllByRole("button", {
      name: "Change reporting period, currently 30 days",
    });
    expect(controls).toHaveLength(3);
    for (const control of controls) {
      await fireEvent.press(control);
    }
    expect(mockPresentPeriod).toHaveBeenCalledTimes(3);

    for (const label of [
      "How analytics are measured",
      "About visibility trends",
      "About route-planning activity",
    ]) {
      const information = screen.getByRole("button", { name: label });
      expect(
        within(information.parent!).getByRole("button", {
          name: "Change reporting period, currently 30 days",
        }),
      ).toBeTruthy();
      await fireEvent.press(information);
    }
    expect(mockPresentInformation.mock.calls).toEqual([
      ["business"],
      ["visibility"],
      ["route"],
    ]);
    for (const title of ["Specialty Support", "Reviews needing replies"]) {
      expect(
        within(screen.getByRole("header", { name: title }).parent!).queryByRole(
          "button",
          { name: /Change reporting period/ },
        ),
      ).toBeNull();
    }
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(analyticsSuccess()));
  });

  it("changes only the overview period and keeps information available during its skeleton", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await screen.findByLabelText(/Recorded profile visits: 24/);
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);

    await fireEvent.press(
      screen.getAllByRole("button", {
        name: "Change reporting period, currently 30 days",
      })[0],
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));

    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    expect(
      screen.getAllByRole("button", {
        name: "Change reporting period, currently 7 days",
      }),
    ).toHaveLength(1);
    expect(getAnalytics).toHaveBeenLastCalledWith("7");
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
        "30",
        expect.any(AbortSignal),
      ),
    );
    expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
      { period: "30" },
      "weekly",
      expect.any(AbortSignal),
    );
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(1);
    for (const label of [
      "How analytics are measured",
      "About visibility trends",
      "About route-planning activity",
    ]) {
      await fireEvent.press(screen.getByRole("button", { name: label }));
    }
    expect(mockPresentInformation).toHaveBeenCalledWith("business");
    expect(mockPresentInformation).toHaveBeenCalledWith("visibility");
    expect(mockPresentInformation).toHaveBeenCalledWith("route");
    expect(getAnalytics).toHaveBeenCalledTimes(2);
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(analyticsSuccess()));
  });

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
        <MerchantAnalyticsScreen />
      </QueryClientProvider>,
    );
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);
    jest.mocked(plusService.getMerchantPlusPocket).mockClear();
    jest.mocked(plusService.getMerchantPlusReviewPerformance).mockClear();

    mockFocused = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantAnalyticsScreen />
      </QueryClientProvider>,
    );
    expect(plusService.getMerchantPlusPocket).not.toHaveBeenCalled();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
    expect(screen.getByText("Recorded saves")).toBeTruthy();

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
        <MerchantAnalyticsScreen />
      </QueryClientProvider>,
    );
    getAnalytics.mockRejectedValueOnce(new Error("Network unavailable"));
    jest.mocked(plusService.getMerchantPlusPocket).mockClear();
    jest.mocked(plusService.getMerchantPlusReviewPerformance).mockClear();
    mockFocused = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantAnalyticsScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Unable to refresh analytics")).toBeTruthy();
    expect(screen.getByText("Recorded saves")).toBeTruthy();
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
        .getByTestId("merchant-analytics-scroll")
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

  it("opens the Standard visit-source report with the selected period despite restricted Plus access", async () => {
    const screen = await renderScreen();
    await waitFor(() =>
      expect(
        client.getQueryData(
          merchantPlusStatusKey(useAuthStore.getState().user?.id),
        ),
      ).toMatchObject({ has_plus_access: false }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open Where visits came from" }),
      ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Where visits came from" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(merchant)/analytics/discovery-sources",
      params: { period: "7" },
    });
  });

  it("shows four business KPIs with replies outside the grid and specialty support immediately next", async () => {
    const screen = await renderScreen();
    const grid = within(await screen.findByTestId("business-overview-grid"));
    for (const name of [
      "Recorded profile visits",
      "Recorded saves",
      "New reviews",
      "Total vouches",
    ]) {
      expect(grid.getByLabelText(new RegExp(`^${name}:`))).toBeTruthy();
    }
    expect(grid.queryByLabelText(/^Reviews replied to:/)).toBeNull();
    expect(screen.getByTestId("analytics-reply-card")).toBeTruthy();
    const headings = screen
      .getAllByRole("header")
      .map((heading) => heading.props.children);
    const businessIndex = headings.indexOf("Business overview");
    expect(businessIndex).toBeGreaterThanOrEqual(0);
    expect(headings.slice(businessIndex, businessIndex + 6)).toEqual([
      "Business overview",
      "Specialty Support",
      "Reviews needing replies",
      "Visibility trends",
      "Route-planning activity",
      "More insights",
    ]);
    expect(screen.getAllByText("Total vouches")).toHaveLength(1);
  });

  it("changes route-planning periods and includes the independent section in pull-to-refresh", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/Route-planning method breakdown/);
    expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
      "30",
      expect.anything(),
    );
    await chooseSectionPeriod(screen, "Route-planning activity", "7");
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
        "7",
        expect.anything(),
      ),
    );
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const before = jest.mocked(getMerchantRoutePlanning).mock.calls.length;
    await act(async () => {
      screen
        .getByTestId("merchant-analytics-scroll")
        .props.refreshControl.props.onRefresh();
    });
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(before + 1),
    );
  });

  it("recovers a route-planning request error without refetching Standard KPIs", async () => {
    jest.mocked(getMerchantRoutePlanning).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderScreen();
    const retry = await screen.findByRole("button", {
      name: /Unable to load route-planning activity.*retry/i,
    });
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText("Recorded route requests: 4");
    expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(2);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it("keeps the current reply backlog independent of period changes and refreshes it on pull", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText("8 published reviews waiting for your reply");
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("7"));
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(1);
    await act(async () => {
      screen
        .getByTestId("merchant-analytics-scroll")
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
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText("8 published reviews waiting for your reply");
    expect(getMerchantUnansweredReviews).toHaveBeenCalledTimes(2);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it.each([0, null, undefined])(
    "preserves a vouch snapshot of %s without summing supporters",
    async (value) => {
      getAnalytics.mockResolvedValueOnce(
        analyticsSuccess(
          standardAnalyticsReport({ current_valid_vouches: value }),
        ),
      );
      const screen = await renderScreen();
      expect(
        await screen.findByLabelText(
          `Total vouches: ${value === 0 ? "0" : "Unavailable"}. Current.`,
        ),
      ).toBeTruthy();
    },
  );

  it("hides a cached vouch count when the domain source is unavailable", async () => {
    const report = standardAnalyticsReport();
    report.sources.domain.availability = "unavailable";
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();
    expect(
      await screen.findByLabelText("Total vouches: Unavailable. Current."),
    ).toBeTruthy();
  });

  it("opens the shared notification inbox from the Analytics header", async () => {
    const screen = await renderScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });

  it("switches visibility metrics without fetching another report and separates interval/period queries", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await screen.findByLabelText(/^Recorded profile visits: 24$/);
    expect(screen.getAllByTestId(/^analytics-column-/)).toHaveLength(4);
    await fireEvent.press(
      screen.getByRole("button", { name: "Show: Impressions" }),
    );
    expect(screen.getByLabelText("Recorded impressions: 39")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Show: Visitor accounts",
      }),
    );
    expect(screen.getByLabelText("Recorded visitor accounts: 12")).toBeTruthy();
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole("button", { name: "Group by: Weekly" }),
    );
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(2),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "90" },
        "weekly",
        expect.anything(),
      ),
    );
    expect(getAnalytics).toHaveBeenLastCalledWith("90");
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
  });

  it("defaults 90 days to weekly and preserves explicit daily choices through metric changes and refresh", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await screen.findByLabelText(/^Recorded profile visits: 24$/);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
      { period: "30" },
      "daily",
      expect.anything(),
    );

    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "90" },
        "weekly",
        expect.anything(),
      ),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Group by: Daily" }),
    );
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "90" },
        "daily",
        expect.anything(),
      ),
    );
    const beforeMetricChange = jest.mocked(
      plusService.getMerchantPlusVisibility,
    ).mock.calls.length;
    await fireEvent.press(
      screen.getByRole("button", { name: "Show: Visitor accounts" }),
    );
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(
      beforeMetricChange,
    );
    expect(screen.getByLabelText("Recorded visitor accounts: 12")).toBeTruthy();

    await act(async () => {
      screen
        .getByTestId("merchant-analytics-scroll")
        .props.refreshControl.props.onRefresh();
    });
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(
        beforeMetricChange + 1,
      ),
    );
    expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
      { period: "90" },
      "daily",
      expect.anything(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "7" },
        "daily",
        expect.anything(),
      ),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    expect(
      screen.getByRole("button", { name: "Group by: Daily" }).props
        .accessibilityState.selected,
    ).toBe(true);
  });

  it("opens only implemented Plus details with the selected reporting period", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();
    await screen.findByRole("button", { name: "Open Pocket Trends" });
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Pocket Trends" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: "pocket", period: "7" },
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "View specialty trends" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: "specialties", period: "7" },
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Review Performance" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: "reviews", period: "7" },
    });
    for (const [title, report] of [
      ["Peer Comparisons", "peers"],
      ["Review Insights", "review-insights"],
      ["Profile-Visit Timing", "timing"],
      ["Business Recommendations", "recommendations"],
    ]) {
      await fireEvent.press(
        screen.getByRole("button", { name: `Open ${title}` }),
      );
      expect(mockNavigate).toHaveBeenLastCalledWith({
        pathname: "/(merchant)/analytics/[report]",
        params: { report, period: "7" },
      });
    }
    expect(plusService.getMerchantPlusPocket).toHaveBeenCalled();
    expect(plusService.getMerchantPlusSpecialties).not.toHaveBeenCalled();
  });

  it("keeps Standard usable when Plus visibility fails and retries only visibility", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    jest.mocked(plusService.getMerchantPlusVisibility).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await renderScreen();
    const retry = await screen.findByRole("button", {
      name: /Unable to load this report.*retry/i,
    });
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/^Recorded profile visits: 24$/);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(2);
  });

  it("keeps a valid zero total when visibility buckets are unavailable", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const report = visibilityReport();
    report.metrics.profile_visits.value = 0;
    report.metrics.profile_visits.series = null;
    jest
      .mocked(plusService.getMerchantPlusVisibility)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderScreen();
    await screen.findByLabelText("Recorded profile visits: 0");
    expect(
      screen.getByRole("button", {
        name: /Recorded activity unavailable.*retry/i,
      }),
    ).toBeTruthy();
    expect(screen.queryAllByTestId(/^analytics-column-/)).toHaveLength(0);
    expect(screen.queryByText(/Previous period ·/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show Plus measurement details" }),
    );
    expect(screen.getByText(/Previous period ·/)).toBeTruthy();
    expect(
      screen.getByText(/cannot reliably show business growth/),
    ).toBeTruthy();
    expect(screen.getByTestId("analytics-chart-empty-state")).toHaveStyle({
      minHeight: 196,
    });
    expect(
      screen.queryByText("No recorded activity in this period"),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Recorded activity unavailable.*retry/i,
      }),
    );
    await screen.findByLabelText(/^Recorded profile visits: 24$/);
    expect(screen.getAllByTestId(/^analytics-column-/)).toHaveLength(4);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });

  it("shows exact sparse observations when the total is unavailable and avoids an invented line", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const report = visibilityReport();
    report.metrics.profile_visits.value = null;
    report.metrics.profile_visits.series =
      report.metrics.profile_visits.series!.slice(0, 1);
    jest
      .mocked(plusService.getMerchantPlusVisibility)
      .mockResolvedValueOnce(plusSuccess(report));
    const screen = await renderScreen();
    await screen.findByLabelText("Recorded profile visits: Unavailable");
    expect(screen.getByText("Recorded counts")).toBeTruthy();
    expect(
      screen.getByLabelText(/^Recorded profile visits, .*: 2$/),
    ).toBeTruthy();
    expect(screen.queryAllByTestId(/^analytics-column-/)).toHaveLength(0);
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
  });

  it("does not request Plus reports for restricted merchants", async () => {
    const screen = await renderScreen();
    await screen.findByText("Report access unavailable");
    expect(plusService.getMerchantPlusVisibility).not.toHaveBeenCalled();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Recorded profile visits: 24\./)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Open Pocket Trends" }),
    ).toBeNull();
  });

  it("shows only the backend-approved Plus reply-rate change for the matching Standard cohort", async () => {
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(plusStatus()));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(
        /Reviews replied to: 25%\. 1 of 4 reviews\. \+25 pp versus the previous period/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("+25 pp")).toBeTruthy();
    expect(
      screen.getByTestId("analytics-reply-progress-fill").props.style,
    ).toEqual({ width: "25%" });
    expect(screen.getByText("vs previous period")).toBeTruthy();
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
    expect(
      await screen.findByLabelText(
        /New reviews: 4\..*\+3 versus the previous period/,
      ),
    ).toBeTruthy();
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

      expect(await screen.findByText(caseValue.label)).toBeTruthy();
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
        /Reviews replied to: 0%\. 0 of 4 reviews\. −25 pp/,
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("analytics-reply-progress")).toBeTruthy();
    expect(
      screen.getByTestId("analytics-reply-progress-fill").props.style,
    ).toEqual({ width: "0%" });
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
      screen.getByLabelText(/Reviews replied to: 25%\. 1 of 4/),
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
      screen.getByLabelText(/Reviews replied to: 25%\. 1 of 4/),
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
      screen.getByLabelText(/Reviews replied to: 25%\. 1 of 4/),
    ).toBeTruthy();
    expect(screen.queryByText(/pp$/)).toBeNull();
    expect(Toast.show).toHaveBeenCalled();
  });

  it("keeps the header and selected 30-day filter visible during section loading", async () => {
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);
    const screen = await renderScreen();

    expect(screen.getByText("Analytics")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Last 30 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    expect(screen.getByLabelText("Loading snapshot")).toBeTruthy();
    expect(screen.getByLabelText("Loading specialties")).toBeTruthy();
    expect(getAnalytics).toHaveBeenCalledWith("30");

    await act(async () => pending.resolve(analyticsSuccess()));
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading activity")).toBeNull(),
    );
  });

  it("changes periods without relabeling old KPI data or filtering current snapshots", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/Recorded profile visits: 24/);
    expect(screen.getByLabelText("Total vouches: 8. Current.")).toBeTruthy();
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));

    expect(getAnalytics).toHaveBeenLastCalledWith("7");
    expect(screen.queryByLabelText(/Recorded profile visits: 24/)).toBeNull();
    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Published reviews: 10")).toBeTruthy();

    await act(async () =>
      pending.resolve(
        analyticsSuccess(standardAnalyticsReport({ profile_visits: 2 })),
      ),
    );
    await screen.findByLabelText(/Recorded profile visits: 2\./);
    expect(screen.getByLabelText("Total vouches: 8. Current.")).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Published reviews: 10")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    await waitFor(() => expect(getAnalytics).toHaveBeenLastCalledWith("90"));
  });

  it("distinguishes null tracking from zero and displays the backend reply rate", async () => {
    const report = standardAnalyticsReport({
      profile_visits: null,
      distinct_profile_visitors: 0,
      saves_in_period: 0,
    });
    report.reviews.reply_rate = 25.4;
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(/Recorded profile visits: Unavailable/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Recorded saves: 0\./)).toBeTruthy();
    expect(
      screen.getByLabelText(/Reviews replied to: 25.4%.*1 of 4/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Some activity is unavailable.*retry/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/Some activity may not be recorded/)).toBeTruthy();
  });

  it("does not manufacture a rate or review action for an empty review cohort", async () => {
    const report = standardAnalyticsReport({
      profile_visits: 0,
      saves_in_period: 0,
      distinct_profile_visitors: 0,
    });
    report.reviews = {
      ...report.reviews,
      new_published_in_period: 0,
      period_eligible_published: 0,
      period_replied_published: 0,
      reply_rate: null,
      current_unanswered_published: 0,
    };
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(/Recorded profile visits: 0\./),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Reviews replied to: Unavailable.*No published reviews/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "View merchant reviews" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /activity is unavailable.*retry/i }),
    ).toBeNull();
    expect(plusService.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
    expect(screen.queryByTestId("analytics-reply-progress")).toBeNull();
  });

  it("preserves SQL results during a visibility outage and retries the same query", async () => {
    const report = standardAnalyticsReport({
      profile_visits: null,
      saves_in_period: null,
      distinct_profile_visitors: null,
    });
    report.sources.visibility = {
      ...standardAnalyticsMeta(),
      availability: "unavailable",
      partial_reasons: ["source_unavailable"],
    };
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();
    const retry = await screen.findByRole("button", {
      name: /Recorded activity unavailable.*retry/i,
    });

    expect(screen.getByLabelText(/New reviews: 4\./)).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/Recorded profile visits: 24/);
    expect(getAnalytics).toHaveBeenCalledTimes(2);
  });

  it("renders a missing visibility collection as unavailable and preserves current snapshots", async () => {
    const report = standardAnalyticsReport({
      profile_visits: null,
      distinct_profile_visitors: null,
      saves_in_period: null,
    });
    report.sources.visibility = {
      ...standardAnalyticsMeta(),
      availability: "unavailable",
      partial_reason: "event_totals_unavailable",
      partial_reasons: [
        "event_totals_unavailable",
        "visibility_collection_missing",
        "distinct_visitors_unavailable",
        "source_unavailable",
      ],
    };
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();

    const retry = await screen.findByRole("button", {
      name: /Recorded activity unavailable.*retry/i,
    });
    expect(
      screen.getByLabelText(/Recorded profile visits: Unavailable/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Recorded saves: Unavailable/)).toBeTruthy();
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Published reviews: 10")).toBeTruthy();
    expect(screen.getByLabelText(/New reviews: 4\./)).toBeTruthy();
    expect(screen.getByLabelText(/Reviews replied to: 25%/)).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/Recorded profile visits: 24/);
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
    await screen.findByLabelText(/Recorded profile visits: 24/);
    expect(
      screen.queryByRole("button", {
        name: /Unable to load analytics.*retry/i,
      }),
    ).toBeNull();
  });

  it("keeps cached content during pull-to-refresh and after a failed refresh", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/Recorded profile visits: 24/);
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);

    await act(async () => {
      screen
        .getByTestId("merchant-analytics-scroll")
        .props.refreshControl.props.onRefresh();
    });

    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
    expect(screen.queryByLabelText("Loading activity")).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByTestId("merchant-analytics-scroll").props.refreshControl
          .props.refreshing,
      ).toBe(true),
    );
    await act(async () =>
      pending.resolve({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      }),
    );

    await screen.findByRole("button", {
      name: /Unable to refresh analytics.*retry/i,
    });
    expect(
      screen.getByLabelText("Accounts with your business in a Pocket: 18"),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
  });

  it("opens oldest unanswered reviews using the Standard backlog without extra report requests", async () => {
    const screen = await renderScreen();
    const reviews = await screen.findByRole("button", {
      name: "Review oldest first",
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

  it("ranks specialty support without losing zero-support specialties or modifying the cache", async () => {
    const report = standardAnalyticsReport();
    report.specialty_support.push({
      specialty_id: 3,
      specialty_name: "Local produce",
      valid_vouches: 0,
      distinct_supporters: 0,
    });
    getAnalytics.mockResolvedValueOnce(analyticsSuccess(report));
    const screen = await renderScreen();

    expect(
      await screen.findByLabelText(
        /^1\. Friendly service: 6 vouches that still count/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /^3\. Local produce: 0 vouches that still count, 0 supporting accounts/,
      ),
    ).toBeTruthy();
    expect(report.specialty_support[0].specialty_name).toBe("Coffee");
  });

  it("shows a true specialty empty state separately from unavailable source data", async () => {
    getAnalytics.mockResolvedValueOnce(
      analyticsSuccess(standardAnalyticsReport({ specialty_support: [] })),
    );
    const screen = await renderScreen();

    expect(await screen.findByText("No active specialties")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Specialty support unavailable.*retry/i,
      }),
    ).toBeNull();
  });

  it("uses specialty identities matched by ID rather than profile order", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);

    expect(MaterialCommunityIcons).toHaveBeenCalledWith(
      expect.objectContaining({ name: "coffee-outline" }),
      undefined,
    );
    expect(MaterialCommunityIcons).toHaveBeenCalledWith(
      expect.objectContaining({ name: "heart-outline" }),
      undefined,
    );
    expect(screen.getByTestId("specialty-support-bar-1")).toBeTruthy();
    expect(screen.getByText(/longest bar has/)).toBeTruthy();
  });

  it("uses the business display cover in the header and falls back if it fails", async () => {
    const screen = await renderScreen();
    const cover = await screen.findByLabelText("Cebu Coffee cover photo");

    expect(cover.props.source).toEqual({
      uri: "https://example.com/business-cover.jpg",
    });
    await fireEvent(cover, "error");
    expect(screen.queryByLabelText("Cebu Coffee cover photo")).toBeNull();
    expect(screen.getByText("Analytics")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeTruthy();
  });

  it("does not use specialty identities from a different business", async () => {
    mockProfileBusinessId = 999;
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);
    expect(screen.queryByLabelText("Cebu Coffee cover photo")).toBeNull();

    expect(MaterialCommunityIcons).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "coffee-outline" }),
      undefined,
    );
    expect(
      screen.getByLabelText(/^2\. Coffee: 2 vouches that still count/),
    ).toBeTruthy();
  });

  it("retains specialty counts when profile metadata fails and retries only that source", async () => {
    mockProfileError = { code: "NETWORK_ERROR" };
    const screen = await renderScreen();
    await screen.findByText("Specialty icons and colors unavailable");

    expect(
      screen.getByLabelText(
        /^1\. Friendly service: 6 vouches that still count/,
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });
});
