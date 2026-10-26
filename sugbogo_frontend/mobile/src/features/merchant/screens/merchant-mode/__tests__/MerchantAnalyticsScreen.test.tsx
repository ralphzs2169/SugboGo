import { storedInsightsReport } from "../../../__tests__/merchantAdvancedAnalytics.fixtures";
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
  standardAnalyticsReport,
  unansweredReviewsSummary,
} from "../../../__tests__/merchantAnalytics.fixtures";
import {
  getMerchantStandardAnalytics,
  getMerchantUnansweredReviews,
} from "../../../api/merchantAnalytics.service";
import { merchantPlusStatusKey } from "../../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import MerchantAnalyticsScreen from "../MerchantAnalyticsScreen";
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
jest.mock("@/features/notifications/components/NotificationBellButton", () => ({
  __esModule: true,
  default: () => null,
}));
const mockExport = jest.fn();
jest.mock("../../../components/analytics/AnalyticsExport", () => ({
  __esModule: true,
  default: (props: { enabled: boolean }) => {
    mockExport(props);
    return null;
  },
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
  getMerchantPlusStoredInsights: jest.fn(),
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
    jest
      .mocked(plusService.getMerchantPlusSpecialties)
      .mockReset()
      .mockResolvedValue(plusSuccess(specialtyReport()));
    jest
      .mocked(plusService.getMerchantPlusStoredInsights)
      .mockReset()
      .mockResolvedValue(plusSuccess(storedInsightsReport()));
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
      screen.getAllByRole("button", { name: `Last ${days} days` })[0],
    );
  }

  function allowCachedPlusAccess() {
    const status = plusStatus();
    client.setQueryData(merchantPlusStatusKey(42), status);
    jest
      .mocked(plusService.getMerchantPlusStatus)
      .mockResolvedValue(plusSuccess(status));
  }

  it("keeps all reports and export visible without checking entitlement", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);
    await waitFor(() =>
      expect(plusService.getMerchantPlusStoredInsights).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusVisibility).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusPocket).toHaveBeenCalledTimes(1);
    expect(plusService.getMerchantPlusStatus).not.toHaveBeenCalled();
    expect(mockExport).toHaveBeenCalledWith({ enabled: true });
    expect(screen.queryByText("Report access unavailable")).toBeNull();
  });

  it("retries report failures directly without an entitlement guard", async () => {
    jest
      .mocked(plusService.getMerchantPlusPocket)
      .mockResolvedValueOnce({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      });
    const screen = await renderScreen();
    await screen.findByText("Pocket activity unavailable");
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Pocket activity unavailable.*retry/i,
      }),
    );
    await waitFor(() =>
      expect(plusService.getMerchantPlusPocket).toHaveBeenCalledTimes(2),
    );
    expect(plusService.getMerchantPlusStatus).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("Pocket activity unavailable")).toBeNull(),
    );
  });

  it("opens the shared notification inbox from the Analytics header", async () => {
    const screen = await renderScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
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
      await screen.findByLabelText(/^1\. Friendly service: 6 valid vouches/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /^3\. Local produce: 0 valid vouches, 0 supporting accounts/,
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
    expect(screen.getByLabelText(/^2\. Coffee: 2 valid vouches/)).toBeTruthy();
  });

  it("retains specialty counts when profile metadata fails and retries only that source", async () => {
    mockProfileError = { code: "NETWORK_ERROR" };
    const screen = await renderScreen();
    await screen.findByText("Specialty icons and colors unavailable");

    expect(
      screen.getByLabelText(/^1\. Friendly service: 6 valid vouches/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Specialty icons and colors unavailable.*retry/i,
      }),
    );
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });
  it("keeps detailed reports without the dashboard overview or backlog", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);
    expect(screen.queryByTestId("business-overview-grid")).toBeNull();
    expect(
      screen.queryByRole("header", { name: "Reviews needing replies" }),
    ).toBeNull();
    expect(getMerchantUnansweredReviews).not.toHaveBeenCalled();
    expect(screen.getByRole("header", { name: "Pocket trends" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Open Pocket trends" }),
    ).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Open Review insights" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Open Review performance" }),
    ).toBeTruthy();
  });

  it("changes visibility and route periods independently and refreshes their reports", async () => {
    allowCachedPlusAccess();
    const screen = await renderScreen();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await chooseSectionPeriod(screen, "Visibility trends", "7");
    await waitFor(() =>
      expect(plusService.getMerchantPlusVisibility).toHaveBeenLastCalledWith(
        { period: "7" },
        "daily",
        expect.anything(),
      ),
    );
    await chooseSectionPeriod(screen, "Route-planning activity", "90");
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenLastCalledWith(
        "90",
        expect.anything(),
      ),
    );
    expect(getAnalytics).toHaveBeenLastCalledWith("30");
    expect(getMerchantUnansweredReviews).not.toHaveBeenCalled();
    const routeRequests = jest.mocked(getMerchantRoutePlanning).mock.calls
      .length;
    await act(async () =>
      screen
        .getByTestId("merchant-analytics-scroll")
        .props.refreshControl.props.onRefresh(),
    );
    await waitFor(() =>
      expect(getMerchantRoutePlanning).toHaveBeenCalledTimes(routeRequests + 1),
    );
  });

  it("opens detailed reports using the default report period", async () => {
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Where visits came from" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(merchant)/analytics/discovery-sources",
      params: { period: "30" },
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Specialty trends" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: "specialties", period: "30" },
    });
  });

  it("opens discovery reports with the visibility section's selected period", async () => {
    const screen = await renderScreen();
    await chooseSectionPeriod(screen, "Visibility trends", "7");
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Where visits came from" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/discovery-sources",
      params: { period: "7" },
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Profile visit timing" }),
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: "timing", period: "7" },
    });
  });
});
