import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
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
} from "../../../__tests__/merchantAnalytics.fixtures";
import { getMerchantStandardAnalytics } from "../../../api/merchantAnalytics.service";
import MerchantAnalyticsScreen from "../MerchantAnalyticsScreen";

const mockNavigate = jest.fn();
const mockRefetchProfile = jest.fn();
let mockProfileError: unknown = null;
let mockProfileBusinessId = 8;

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: {
      id: mockProfileBusinessId,
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
  useRouter: () => ({ navigate: mockNavigate }),
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantStandardAnalytics: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: jest.fn(() => null),
}));
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

const getAnalytics = jest.mocked(getMerchantStandardAnalytics);

jest.setTimeout(15_000);

describe("MerchantAnalyticsScreen", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    getAnalytics.mockReset();
    getAnalytics.mockResolvedValue(analyticsSuccess());
    mockNavigate.mockClear();
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
    const pending = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));

    expect(getAnalytics).toHaveBeenLastCalledWith("7");
    expect(screen.queryByLabelText(/Recorded profile visits: 24/)).toBeNull();
    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    expect(screen.getByLabelText("Current Pocket holders: 18")).toBeTruthy();
    expect(screen.getByLabelText("Published reviews: 10")).toBeTruthy();

    await act(async () =>
      pending.resolve(
        analyticsSuccess(standardAnalyticsReport({ profile_visits: 2 })),
      ),
    );
    await screen.findByLabelText(/Recorded profile visits: 2\./);
    expect(screen.getByLabelText("Current Pocket holders: 18")).toBeTruthy();
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
    expect(screen.getByLabelText(/Reply rate: 25.4%.*1 of 4/)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Some activity is unavailable.*retry/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/coverage is unverified/)).toBeTruthy();
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
      screen.getByLabelText(/Reply rate: Unavailable.*No eligible reviews/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "View merchant reviews" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /activity is unavailable.*retry/i }),
    ).toBeNull();
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
    expect(screen.getByLabelText("Current Pocket holders: 18")).toBeTruthy();
    await fireEvent.press(retry);
    await screen.findByLabelText(/Recorded profile visits: 24/);
    expect(getAnalytics).toHaveBeenCalledTimes(2);
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
    expect(screen.getByLabelText("Current Pocket holders: 18")).toBeTruthy();
    expect(screen.getByLabelText(/Recorded profile visits: 24/)).toBeTruthy();
  });

  it("navigates only to the existing Reviews screen and keeps Plus previews informational", async () => {
    const screen = await renderScreen();
    const reviews = await screen.findByRole("button", {
      name: "View merchant reviews",
    });

    await fireEvent.press(reviews);

    expect(mockNavigate).toHaveBeenCalledWith("/(merchant)/(tabs)/reviews");
    for (const title of [
      "Visibility Trends",
      "Review Performance",
      "Peer Comparisons",
      "Customer Activity Times",
      "Business Recommendations",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: new RegExp(title) }),
      ).toBeNull();
    }
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
      await screen.findByLabelText(/^1\. Friendly service: 6 valid vouches/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /^3\. Local produce: 0 valid vouches, 0 distinct supporters/,
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
    expect(screen.getByText(/highest count filling the scale/)).toBeTruthy();
  });

  it("does not use specialty identities from a different business", async () => {
    mockProfileBusinessId = 999;
    const screen = await renderScreen();
    await screen.findByLabelText(/^1\. Friendly service/);

    expect(MaterialCommunityIcons).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "coffee-outline" }),
      undefined,
    );
    expect(screen.getByLabelText(/^2\. Coffee: 2 valid vouches/)).toBeTruthy();
  });

  it("retains specialty counts when profile metadata fails and retries only that source", async () => {
    mockProfileError = { code: "NETWORK_ERROR" };
    const screen = await renderScreen();
    await screen.findByText("Specialty styling unavailable");

    expect(
      screen.getByLabelText(/^1\. Friendly service: 6 valid vouches/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(getAnalytics).toHaveBeenCalledTimes(1);
  });
});
