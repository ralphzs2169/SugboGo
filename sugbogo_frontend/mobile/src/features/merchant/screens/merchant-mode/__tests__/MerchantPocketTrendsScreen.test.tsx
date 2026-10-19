import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import {
  pocketReport,
  plusSuccess,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import * as service from "../../../api/merchantPlusAnalytics.service";
import MerchantAnalyticsDetailScreen from "../MerchantAnalyticsDetailScreen";

jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual("../../../__tests__/analyticsSheet.mock")
    .analyticsSheetMock(),
);
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusPocket: jest.fn(),
  getMerchantPlusSpecialties: jest.fn(),
  getMerchantPlusReviewPerformance: jest.fn(),
}));

describe("Pocket trends compact controls and line chart", () => {
  let client: QueryClient;
  const getPocket = jest.mocked(service.getMerchantPlusPocket);
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    jest.clearAllMocks();
    getPocket.mockReset().mockResolvedValue(plusSuccess(pocketReport()));
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });
  const open = () =>
    render(
      <QueryClientProvider client={client}>
        <MerchantAnalyticsDetailScreen kind="pocket" />
      </QueryClientProvider>,
    );

  it("starts at Save activity without an introduction or segmented control", async () => {
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 5/);
    expect(screen.getByRole("header", { name: "Save activity" })).toBeTruthy();
    expect(screen.queryByText("Pocket trends")).toBeNull();
    expect(
      screen.queryByText(
        "Recorded saves and saving accounts during the selected dates.",
      ),
    ).toBeNull();
    expect(screen.queryByText("Reporting period")).toBeNull();
    expect(screen.queryByRole("button", { name: "Last 30 days" })).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Change reporting period, currently 30 days",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Recorded save activity by week")).toBeTruthy();
    expect(screen.queryByText("Weekly")).toBeNull();
    expect(screen.getByLabelText(/^Saving accounts: 3/)).toBeTruthy();
    expect(screen.getAllByTestId(/^analytics-line-/)).toHaveLength(1);
    expect(screen.queryAllByTestId(/^analytics-column-/)).toHaveLength(0);
    expect(service.getMerchantPlusStatus).not.toHaveBeenCalled();
  });

  it("reuses the overview selection sheet, updates requests, and returns to cached periods", async () => {
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 5/);
    for (const [from, to] of [
      ["30", "7"],
      ["7", "90"],
      ["90", "30"],
    ]) {
      await fireEvent.press(
        screen.getByRole("button", {
          name: `Change reporting period, currently ${from} days`,
        }),
      );
      expect(
        screen.getByRole("button", { name: `Last ${from} days` }).props
          .accessibilityState.selected,
      ).toBe(true);
      await fireEvent.press(
        screen.getByRole("button", { name: `Last ${to} days` }),
      );
      await screen.findByLabelText(/^Recorded saves: 5/);
      expect(
        screen.getByRole("button", {
          name: `Change reporting period, currently ${to} days`,
        }),
      ).toBeTruthy();
      expect(screen.queryByText("Reporting period")).toBeNull();
    }
    expect(getPocket.mock.calls.map(([selection]) => selection.period)).toEqual(
      ["30", "7", "90"],
    );
    expect(service.getMerchantPlusSpecialties).not.toHaveBeenCalled();
    expect(service.getMerchantPlusReviewPerformance).not.toHaveBeenCalled();
  });

  it("keeps measurement information and period actions available during loading", async () => {
    let finish!: (
      result: Awaited<ReturnType<typeof service.getMerchantPlusPocket>>,
    ) => void;
    getPocket.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await open();
    expect(screen.getByText("Loading save activity…")).toBeTruthy();
    expect(screen.getByLabelText(/^Recorded saves: Loading/)).toBeTruthy();
    expect(screen.getByLabelText(/^Saving accounts: Loading/)).toBeTruthy();
    expect(screen.getByText("Saves over time")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "About Pocket activity" }),
    );
    expect(
      screen.getByText(/Lines connect consecutive intervals/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Detailed Pocket measurement information",
      }),
    );
    expect(screen.queryByText("Reporting dates")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close Pocket information" }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Change reporting period, currently 30 days",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Last 30 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(
      screen.getByRole("button", { name: "Close selection sheet" }),
    );
    await act(async () => finish(plusSuccess(pocketReport())));
    await screen.findByLabelText(/^Recorded saves: 5/);
  });

  it("keeps the report structure visible while a new period loads", async () => {
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 5/);
    let finish!: (
      result: Awaited<ReturnType<typeof service.getMerchantPlusPocket>>,
    ) => void;
    getPocket.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Change reporting period, currently 30 days",
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    expect(screen.getByLabelText(/^Recorded saves: Loading/)).toBeTruthy();
    expect(screen.getByLabelText(/^Saving accounts: Loading/)).toBeTruthy();
    expect(screen.getByText("Saves over time")).toBeTruthy();
    expect(screen.getByLabelText("Loading save activity")).toBeTruthy();
    expect(screen.queryByText("Loading report…")).toBeNull();
    expect(
      screen.getByRole("button", { name: "About Pocket activity" }),
    ).toBeTruthy();
    await act(async () => finish(plusSuccess(pocketReport())));
    await screen.findByLabelText(/^Recorded saves: 5/);
  });

  it("keeps dates inside the information sheet and omits coverage notices when verified", async () => {
    const report = pocketReport();
    report.metrics.saves.sources.current.coverage_verified = true;
    report.metrics.saves.sources.current.partial_reasons = [];
    getPocket.mockResolvedValueOnce(plusSuccess(report));
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 5/);
    expect(screen.queryByText(/Tracking coverage/)).toBeNull();
    expect(screen.queryByText(/Manila time/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "About Pocket activity" }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Detailed Pocket measurement information",
      }),
    );
    expect(screen.getByText("Reporting dates")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close Pocket information" }),
    );
    expect(screen.queryByText("Reporting dates")).toBeNull();
  });

  it("shows a genuine zero without drawing a line or requiring Retry", async () => {
    const report = pocketReport();
    report.metrics.saves.value = 0;
    report.metrics.saves.series = [];
    report.metrics.distinct_savers.value = 0;
    getPocket.mockResolvedValueOnce(plusSuccess(report));
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 0/);
    expect(screen.getByLabelText(/^Saving accounts: 0/)).toBeTruthy();
    expect(
      screen.getByText("No recorded activity in this period"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
    expect(screen.queryAllByTestId(/^analytics-line-/)).toHaveLength(0);
  });

  it("keeps partial series when totals are unavailable and retries the affected query", async () => {
    const report = pocketReport();
    report.metrics.saves.value = null;
    report.metrics.saves.sources.current.partial_reasons.push(
      "total_read_unavailable",
    );
    getPocket.mockResolvedValueOnce(plusSuccess(report));
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: Unavailable/);
    expect(screen.getByTestId("analytics-point-2026-09-21")).toBeTruthy();
    expect(screen.getByText(/Some figures could not be loaded/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Some recorded activity is unavailable.*retry/i,
      }),
    );
    await screen.findByLabelText(/^Recorded saves: 5/);
  });

  it("recovers a request failure without hiding the section controls", async () => {
    getPocket.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await open();
    const retry = await screen.findByRole("button", {
      name: /Unable to load this report.*retry/i,
    });
    expect(
      screen.getByRole("button", {
        name: "Change reporting period, currently 30 days",
      }),
    ).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/^Recorded saves: 5/);
    expect(getPocket).toHaveBeenCalledTimes(2);
  });

  it("pulls to refresh only Pocket and preserves cached values after a failure", async () => {
    const screen = await open();
    await screen.findByLabelText(/^Recorded saves: 5/);
    getPocket.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () =>
      screen
        .getByTestId("analytics-detail-scroll")
        .props.refreshControl.props.onRefresh(),
    );
    await screen.findByText("Report couldn't refresh");
    expect(screen.getByLabelText(/^Recorded saves: 5/)).toBeTruthy();
    expect(screen.getByTestId("analytics-point-2026-09-21")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.queryByText("Report couldn't refresh")).toBeNull(),
    );
    expect(service.getMerchantPlusSpecialties).not.toHaveBeenCalled();
  });
});
