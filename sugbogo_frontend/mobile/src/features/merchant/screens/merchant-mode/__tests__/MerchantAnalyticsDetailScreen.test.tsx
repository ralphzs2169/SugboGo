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
    await screen.findByLabelText("Distinct saver accounts: 3");
    expect(screen.getByLabelText("Recorded saves: 5")).toBeTruthy();
    expect(
      screen.getByText(/These are not current Pocket holders/),
    ).toBeTruthy();
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
      "Coffee: 2 additions still valid, 2 distinct supporters",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Specialty: Friendly service" }),
    );
    expect(
      screen.getByLabelText(
        "Friendly service: 1 additions still valid, 1 distinct supporters",
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
      screen.getByText(/not historical balances or net growth/),
    ).toBeTruthy();
  });

  it("uses backend sentiment percentages and percentage-point reply comparisons", async () => {
    const screen = await renderDetail("reviews");
    await screen.findByLabelText("Plus reply rate: 25%");
    expect(
      screen.getByLabelText(
        "Positive: 2 reviews, 66.67% of classified reviews",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Negative: 0 reviews, 0% of classified reviews"),
    ).toBeTruthy();
    expect(screen.getByText(/3 classified · 1 unclassified/)).toBeTruthy();
    expect(
      screen.getByText("+25 percentage points vs previous review cohort"),
    ).toBeTruthy();
    expect(screen.getByText("1 hr")).toBeTruthy();
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
    await screen.findByText("Insufficient sentiment data");
    expect(screen.queryByText(/66\.67%/)).toBeNull();
    expect(screen.getByLabelText("Positive: 2 reviews")).toBeTruthy();
    expect(screen.getByLabelText("Plus reply rate: 0%")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Comparison unavailable")).toBeTruthy();
  });

  it("does not fetch any detail when restricted, and retries a failed access check", async () => {
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockResolvedValueOnce({
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
    await screen.findByLabelText("Distinct saver accounts: 3");
  });

  it("recovers a report failure and keeps cached data after a failed refresh", async () => {
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockResolvedValueOnce({
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
    jest
      .mocked(service.getMerchantPlusPocket)
      .mockResolvedValueOnce({
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
