import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/features/auth/store/auth.store";
import DiscoverySourcesRoute from "@/app/(merchant)/analytics/discovery-sources";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import { discoverySourcesReport } from "../../../__tests__/discoverySources.fixtures";
import { getMerchantDiscoverySources } from "../../../api/merchantDiscoverySources.service";
import useMerchantDiscoverySources from "../../../hooks/analytics/useMerchantDiscoverySources";
import { merchantDiscoverySourcesKey } from "../../../hooks/analytics/merchantAnalyticsQueryKeys";
import MerchantDiscoverySourcesScreen from "../MerchantDiscoverySourcesScreen";
import AnalyticsMoreInsights from "../../../components/analytics/AnalyticsMoreInsights";

let mockFocused = true;
jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => ({ period: "7" }),
}));
jest.mock("../../../api/merchantDiscoverySources.service", () => ({
  getMerchantDiscoverySources: jest.fn(),
}));
jest.mock("../../../hooks/analytics/useMerchantPlusAccess", () => () => {
  throw new Error("Standard sources must not check Plus");
});
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 16, left: 0, right: 0 }),
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
const mockPresent = jest.fn();
jest.mock(
  "../../../components/analytics/DiscoverySourcesMeasurementSheet",
  () => ({
    __esModule: true,
    default: ({ sheetRef }: { sheetRef: { current: unknown } }) => {
      jest
        .requireActual("react")
        .useImperativeHandle(sheetRef, () => ({ present: mockPresent }));
      return null;
    },
  }),
);

const getReport = jest.mocked(getMerchantDiscoverySources);
describe("Standard discovery sources", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    getReport.mockReset().mockResolvedValue({
      success: true,
      message: "Report",
      data: discoverySourcesReport(),
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });
  it("loads the genuine Standard route and ranks exact counts without Plus", async () => {
    const screen = await render(<DiscoverySourcesRoute />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Recorded profile visits: 7")).toBeTruthy(),
    );
    expect(getReport).toHaveBeenCalledWith("7", expect.anything());
    expect(
      screen.getByTestId("discovery-source-bar-EXPLORE_DISCOVERY").props.style
        .width,
    ).toBe("100%");
    expect(
      screen.getByTestId("discovery-source-bar-MAP").props.style.width,
    ).toBe("50%");
    expect(
      screen.getByLabelText("Source not recorded: 1 recorded profile visits"),
    ).toBeTruthy();
    expect(screen.queryByText("Vouch history")).toBeNull();
    expect(screen.queryByText("Your reviews")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "About visit sources" }),
    );
    expect(mockPresent).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Last 90 days" }));
    await waitFor(() =>
      expect(getReport).toHaveBeenCalledWith("90", expect.anything()),
    );
    const before = getReport.mock.calls.length;
    await act(async () => {
      await screen
        .getByTestId("discovery-sources-scroll")
        .props.refreshControl.props.onRefresh();
    });
    expect(getReport.mock.calls.length).toBeGreaterThan(before);
  });
  it("keeps initial loading independent and shows a genuine zero", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof getMerchantDiscoverySources>>,
    ) => void;
    getReport.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await render(<MerchantDiscoverySourcesScreen />, {
      wrapper: Wrapper,
    });
    expect(screen.getByLabelText("Loading visit sources")).toBeTruthy();
    await act(async () =>
      resolve({
        success: true,
        message: "Report",
        data: discoverySourcesReport({
          profile_visits: 0,
          sources: [],
          attribution_complete: true,
        }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Recorded profile visits: 0")).toBeTruthy(),
    );
    expect(screen.getByText("No recorded profile visits yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
  it("preserves unknown-source visits rather than hiding their counts", async () => {
    getReport.mockResolvedValue({
      success: true,
      message: "Report",
      data: discoverySourcesReport({
        profile_visits: 2,
        sources: [
          { source: "UNKNOWN", label: "Source not recorded", count: 2 },
        ],
      }),
    });
    const screen = await render(<MerchantDiscoverySourcesScreen />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText("Source not recorded: 2 recorded profile visits"),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(/Some visits have no recorded source/),
    ).toBeTruthy();
  });
  it("notifies request errors and offers persistent Retry without reloading other analytics", async () => {
    getReport.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await render(<MerchantDiscoverySourcesScreen />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByText("Unable to load visit sources")).toBeTruthy(),
    );
    expect(Toast.show).toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to load visit sources.*retry/i,
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Recorded profile visits: 7")).toBeTruthy(),
    );
  });
  it("distinguishes unavailable HTTP 200 data and refetches only this report", async () => {
    const data = discoverySourcesReport();
    getReport.mockResolvedValueOnce({
      success: true,
      message: "Report",
      data: {
        ...data,
        profile_visits: null,
        sources: null,
        attribution_complete: null,
        meta: { ...data.meta, availability: "unavailable" },
      },
    });
    const screen = await render(<MerchantDiscoverySourcesScreen />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText("Recorded profile visits: Unavailable"),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("No recorded profile visits yet")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Visit-source data unavailable.*retry/i,
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Recorded profile visits: 7")).toBeTruthy(),
    );
  });
  it("retains cached reports after refresh failure and separates accounts and periods", async () => {
    const { result, rerender } = await renderHook(
      ({ period }: { period: "7" | "30" }) => ({
        ...useMerchantDiscoverySources(period, mockFocused),
      }),
      { wrapper: Wrapper, initialProps: { period: "30" } },
    );
    await waitFor(() => expect(result.current.data?.profile_visits).toBe(7));
    getReport.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data?.profile_visits).toBe(7);
    mockFocused = false;
    await rerender({ period: "7" });
    expect(result.current.data).toBeUndefined();
    expect(merchantDiscoverySourcesKey(42, "7")).not.toEqual(
      merchantDiscoverySourcesKey(42, "30"),
    );
    await act(async () =>
      useAuthStore.setState({ user: { ...analyticsMerchant(), id: 99 } }),
    );
    expect(result.current.data).toBeUndefined();
    expect(
      client.getQueryData(merchantDiscoverySourcesKey(99, "30")),
    ).toBeUndefined();
  });
  it("does not fetch a report just because its reports-area entry is rendered", async () => {
    const open = jest.fn();
    const openPlus = jest.fn();
    const screen = await render(
      <AnalyticsMoreInsights onOpen={openPlus} onOpenDiscoverySources={open} />,
    );
    expect(getReport).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Where visits came from" }),
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(openPlus).not.toHaveBeenCalled();
  });
});
