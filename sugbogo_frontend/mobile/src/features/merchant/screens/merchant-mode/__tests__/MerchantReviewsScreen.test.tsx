import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAllBusinessReviews } from "@/features/explore/api/reviewBusiness.service";
import type { BusinessReview } from "@/features/explore/types/review.types";
import { getMerchantUnansweredReviews } from "../../../api/merchantAnalytics.service";
import {
  analyticsMerchant,
  unansweredReviewsSummary,
} from "../../../__tests__/merchantAnalytics.fixtures";
import MerchantReviewsScreen from "../MerchantReviewsScreen";
import { getMerchantReviewLocation } from "../../../api/merchantReviewFocus.service";

const mockRouter = { setParams: jest.fn(), push: jest.fn() };
let mockParams: Record<string, unknown> = {};
let mockFocused = true;
const mockRefetchBusiness = jest.fn();
const mockRefetchDisputes = jest.fn();
const mockRefetchTemplates = jest.fn();
let mockBusinessError: unknown = null;
let mockDisputesError: unknown = null;
let mockTemplatesError: unknown = null;
let mockCountsCached = false;
const mockManagement = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: { View: jest.requireActual("react-native").View },
    Easing: { inOut: jest.fn(), quad: jest.fn() },
    ReduceMotion: { System: "system" },
    useReducedMotion: () => true,
    useSharedValue: (value: number) =>
      React.useRef({ value, set: jest.fn() }).current,
    useAnimatedStyle: () => ({}),
    cancelAnimation: jest.fn(),
    withSequence: jest.fn(),
    withTiming: jest.fn(),
  };
});
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual("../../../__tests__/analyticsSheet.mock")
    .analyticsSheetMock(),
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").View,
}));
jest.mock("lottie-react-native", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotificationUnreadCount: () => ({ unreadCount: 0 }),
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: { id: 8 },
    isLoading: false,
    error: mockBusinessError,
    refetch: mockRefetchBusiness,
  }),
}));
jest.mock("../../../hooks/review-disputes/useReviewDisputes", () => ({
  usePendingReviewDisputeCount: () => ({
    count: 0,
    hasData: mockCountsCached || !mockDisputesError,
    error: mockDisputesError,
    isLoading: false,
    refetch: mockRefetchDisputes,
  }),
}));
jest.mock("../../../hooks/reply-templates/useReplyTemplates", () => ({
  useReplyTemplates: () => ({
    templates: [],
    isLoading: false,
    error: mockTemplatesError,
    hasData: mockCountsCached || !mockTemplatesError,
    refetch: mockRefetchTemplates,
  }),
}));
jest.mock(
  "../../../components/review-management/MerchantReviewManagement",
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      mockManagement(props);
      return null;
    },
  }),
);
jest.mock(
  "../../../components/review-management/MerchantReviewReplyComposerSheet",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("../../../components/review-management/MerchantReviewCard", () => ({
  __esModule: true,
  default: ({ review }: { review: BusinessReview }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{`Review ${review.id}`}</Text>;
  },
}));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  getAllBusinessReviews: jest.fn(),
}));
jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn().mockResolvedValue({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  }),
}));
jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantUnansweredReviews: jest.fn(),
}));
jest.mock("../../../api/merchantReviewFocus.service", () => ({
  getMerchantReviewLocation: jest.fn(),
}));
const getReviews = jest.mocked(getAllBusinessReviews);

function response(ids: number[], page = 1, hasNext = false) {
  return {
    success: true as const,
    message: "Success",
    data: {
      items: ids.map((id) => ({ id }) as BusinessReview),
      pagination: {
        page,
        page_size: 1,
        total_items: hasNext ? 2 : ids.length,
        total_pages: hasNext ? 2 : page,
        has_next: hasNext,
        has_previous: page > 1,
      },
    },
  };
}

jest.setTimeout(15_000);

describe("merchant Reviews screen backlog integration", () => {
  let client: QueryClient;
  beforeEach(() => {
    mockBusinessError = null;
    mockDisputesError = null;
    mockTemplatesError = null;
    mockCountsCached = false;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    mockFocused = true;
    mockParams = {
      filter: "needs-reply",
      ordering: "oldest",
      reviewIntent: "1",
    };
    mockRouter.setParams.mockClear();
    getReviews.mockReset().mockResolvedValue(response([1]));
    jest.mocked(getMerchantReviewLocation).mockReset();
    jest.mocked(getMerchantUnansweredReviews).mockReset().mockResolvedValue({
      success: true,
      message: "Success",
      data: unansweredReviewsSummary(),
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("opens an older notification review directly and permits loading newer reviews", async () => {
    mockParams = { reviewId: "82", filter: "all", ordering: "newest" };
    jest.mocked(getMerchantReviewLocation).mockResolvedValue({
      success: true,
      message: "Success",
      data: { review_id: 82, page: 9, page_size: 10 },
    });
    getReviews.mockImplementation(async (_business, _filters, page) =>
      response(page === 9 ? [82] : [90], page, true),
    );
    const screen = await render(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    await screen.findByText("Review 82");
    expect(getMerchantReviewLocation).toHaveBeenCalledWith(8, 82);
    expect(getReviews).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ needsReply: false, ordering: "newest" }),
      9,
      10,
    );
    expect(getReviews.mock.calls.some((call) => call[2] === 1)).toBe(false);
    await fireEvent.press(
      screen.getByRole("button", { name: "Load newer reviews" }),
    );
    await screen.findByText("Review 90");
    expect(screen.getByText("Review 82")).toBeTruthy();
    expect(getReviews).toHaveBeenLastCalledWith(8, expect.anything(), 8, 10);
  });

  it("keeps Reviews usable when the notification review is unavailable", async () => {
    mockParams = { reviewId: "82", filter: "all", ordering: "newest" };
    jest.mocked(getMerchantReviewLocation).mockResolvedValue({
      success: false,
      message: "This review is no longer available.",
      code: "NOT_FOUND",
    });
    const screen = await render(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    await screen.findByText("Review no longer available");
    await screen.findByText("Review 1");
    expect(getReviews).toHaveBeenCalledWith(8, expect.anything(), 1);
    await waitFor(() =>
      expect(screen.queryByText("Unable to open this review")).toBeNull(),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue browsing reviews" }),
    );
    expect(screen.queryByText("Review no longer available")).toBeNull();
  });

  it("clears an obsolete page after a previously located review becomes unavailable", async () => {
    mockParams = { reviewId: "82", filter: "all", ordering: "newest" };
    jest
      .mocked(getMerchantReviewLocation)
      .mockResolvedValueOnce({
        success: true,
        message: "Success",
        data: { review_id: 82, page: 9, page_size: 10 },
      })
      .mockResolvedValue({
        success: false,
        message: "This review is no longer available.",
        code: "NOT_FOUND",
      });
    getReviews.mockImplementation(async (_business, _filters, page) =>
      response(page === 9 ? [80] : [1], page),
    );
    const screen = await openScreen();
    const locate = await screen.findByRole("button", {
      name: /Review no longer on this page.*locate review/i,
    });
    await fireEvent.press(locate);
    await screen.findByText("Review no longer available");
    await screen.findByText("Review 1");
    expect(screen.queryByText("Review 80")).toBeNull();
    expect(screen.queryByText("Review no longer on this page")).toBeNull();
    expect(screen.queryByText("Unable to open this review")).toBeNull();
    expect(getMerchantReviewLocation).toHaveBeenCalledTimes(2);
  });

  it("shows only a temporary failure after a failed relocation and prevents repeated retries", async () => {
    mockParams = { reviewId: "82", filter: "all", ordering: "newest" };
    jest
      .mocked(getMerchantReviewLocation)
      .mockResolvedValueOnce({
        success: true,
        message: "Success",
        data: { review_id: 82, page: 9, page_size: 10 },
      })
      .mockResolvedValueOnce({
        success: false,
        message: "Offline",
        code: "NETWORK_ERROR",
      });
    const screen = await openScreen();
    await fireEvent.press(
      await screen.findByRole("button", {
        name: /Review no longer on this page.*locate review/i,
      }),
    );
    const retry = await screen.findByRole("button", {
      name: /Unable to open this review.*try again/i,
    });
    expect(screen.queryByText("Review no longer on this page")).toBeNull();
    expect(screen.queryByText("Review no longer available")).toBeNull();

    let finish!: (
      value: Awaited<ReturnType<typeof getMerchantReviewLocation>>,
    ) => void;
    jest.mocked(getMerchantReviewLocation).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => {
      await fireEvent.press(retry);
      await fireEvent.press(retry);
    });
    expect(getMerchantReviewLocation).toHaveBeenCalledTimes(3);
    await waitFor(() =>
      expect(screen.queryByText("Unable to open this review")).toBeNull(),
    );
    getReviews.mockResolvedValue(response([82]));
    await act(async () =>
      finish({
        success: true,
        message: "Success",
        data: { review_id: 82, page: 1, page_size: 10 },
      }),
    );
    await screen.findByText("Review 82");
    expect(screen.queryByText("Review no longer on this page")).toBeNull();
  });

  it("revalidates a located review and refreshes review data when returning to the tab", async () => {
    mockParams = { reviewId: "82", filter: "all", ordering: "newest" };
    jest.mocked(getMerchantReviewLocation).mockResolvedValue({
      success: true,
      message: "Success",
      data: { review_id: 82, page: 1, page_size: 10 },
    });
    getReviews.mockResolvedValue(response([82]));
    const screen = await openScreen();
    await screen.findByText("Review 82");
    mockFocused = false;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    const invalidation = jest.spyOn(client, "invalidateQueries");
    jest.mocked(getMerchantReviewLocation).mockResolvedValue({
      success: false,
      message: "This review is no longer available.",
      code: "NOT_FOUND",
    });
    getReviews.mockResolvedValue(response([1]));
    const backlogCalls = jest.mocked(getMerchantUnansweredReviews).mock.calls
      .length;
    mockFocused = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    await screen.findByText("Review no longer available");
    await screen.findByText("Review 1");
    expect(getMerchantReviewLocation).toHaveBeenCalledTimes(2);
    expect(
      jest.mocked(getMerchantUnansweredReviews).mock.calls.length,
    ).toBeGreaterThan(backlogCalls);
    for (const prefix of [
      "merchant-business-profile",
      "business-reviews",
      "merchant-review-disputes",
    ]) {
      expect(
        invalidation.mock.calls.some(
          ([filters]) => filters?.queryKey?.[0] === prefix,
        ),
      ).toBe(true);
    }
  });
  async function openScreen() {
    return render(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
  }

  it("opens the notification inbox from the shared Reviews header", async () => {
    const screen = await openScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Notifications" }),
    );
    expect(mockRouter.push).toHaveBeenLastCalledWith("/notifications");
    expect(screen.queryByRole("button", { name: "Search reviews" })).toBeNull();
  });

  it("stages photo filtering until Apply and does not claim a filtered empty feed is caught up", async () => {
    const screen = await openScreen();
    await screen.findByText("Review 1");
    await fireEvent.press(
      screen.getByRole("button", { name: "Filter reviews, 1 active filters" }),
    );
    await screen.findByText("Refine which reviews you want to see.");
    const photoOptions = screen.getAllByRole("button", { name: "With photos" });
    await fireEvent.press(photoOptions[photoOptions.length - 1]);
    expect(getReviews).toHaveBeenCalledTimes(1);
    getReviews.mockResolvedValueOnce(response([]));
    await fireEvent.press(
      screen.getByRole("button", { name: "Apply review filters" }),
    );
    await screen.findByText("No matching reviews");
    expect(screen.queryByText("All caught up")).toBeNull();
    expect(getReviews).toHaveBeenLastCalledWith(
      8,
      expect.objectContaining({ hasPhotos: true, needsReply: true }),
      1,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "With photos, selected" }),
    );
    await screen.findByText("Review 1");
  });

  it("shows requested controls, loads filtered pages on demand and permits manual changes", async () => {
    getReviews.mockResolvedValueOnce(response([1], 1, true));
    const screen = await openScreen();
    await screen.findByText("Review 1");
    expect(
      screen.getByRole("button", { name: "Needs reply, 8" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Sort by Oldest, selected" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByText("Matching reviews")).toBeTruthy();
    expect(getReviews).toHaveBeenCalledTimes(1);
    expect(getReviews).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ needsReply: true, ordering: "oldest" }),
      1,
    );
    getReviews.mockResolvedValueOnce(response([2], 2));
    await act(async () =>
      screen.getByTestId("merchant-reviews-feed").props.onEndReached(),
    );
    await screen.findByText("Review 2");
    expect(screen.getByText("Review 1")).toBeTruthy();
    expect(getReviews).toHaveBeenLastCalledWith(
      8,
      expect.objectContaining({ needsReply: true, ordering: "oldest" }),
      2,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Needs reply, 8" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Sort by Newest" }),
    );
    await waitFor(() =>
      expect(getReviews).toHaveBeenLastCalledWith(
        8,
        expect.objectContaining({ needsReply: false, ordering: "newest" }),
        1,
      ),
    );
  });

  it("clears reply-status filtering while preserving the selected ordering", async () => {
    const screen = await openScreen();
    await screen.findByText("Review 1");
    expect(screen.getByText("Filter & sort")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Needs reply, 8" }),
    );
    await waitFor(() =>
      expect(getReviews).toHaveBeenLastCalledWith(
        8,
        expect.objectContaining({
          needsReply: false,
          merchantReplied: false,
          ordering: "oldest",
        }),
        1,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Clear review filters" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sort by Oldest, selected" }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "With reply" }));
    await waitFor(() =>
      expect(getReviews).toHaveBeenLastCalledWith(
        8,
        expect.objectContaining({
          needsReply: false,
          merchantReplied: true,
          ordering: "oldest",
        }),
        1,
      ),
    );
  });

  it("distinguishes a request failure from all caught up and recovers with Retry", async () => {
    getReviews.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const screen = await openScreen();
    const retry = await screen.findByRole("button", {
      name: /Unable to load reviews.*retry/i,
    });
    expect(screen.queryByText("All caught up")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sort by Oldest, selected" }),
    ).toBeTruthy();
    getReviews.mockResolvedValue(response([]));
    await fireEvent.press(retry);
    await screen.findByText("All caught up");
  });
  it("keeps cached business and reviews after a business refresh failure", async () => {
    mockBusinessError = new Error("Offline");
    const screen = await openScreen();
    expect(screen.getByText("Unable to refresh business")).toBeTruthy();
    expect(screen.getByTestId("merchant-reviews-feed")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to refresh business.*retry/i,
      }),
    );
    expect(mockRefetchBusiness).toHaveBeenCalled();
  });

  it("distinguishes unknown counts, cached zero, and successful zero", async () => {
    mockDisputesError = new Error("Offline");
    mockTemplatesError = new Error("Offline");
    const screen = await openScreen();
    expect(mockManagement.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        pendingDisputeCount: undefined,
        quickResponseCount: undefined,
        disputesUnavailable: true,
        templatesUnavailable: true,
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: /Dispute count unavailable.*retry/i }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Response count unavailable.*retry/i,
      }),
    );
    expect(mockRefetchDisputes).toHaveBeenCalled();
    expect(mockRefetchTemplates).toHaveBeenCalled();
    mockCountsCached = true;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    expect(mockManagement.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        pendingDisputeCount: 0,
        quickResponseCount: 0,
        disputesUnavailable: false,
        templatesUnavailable: false,
      }),
    );
    mockDisputesError = null;
    mockTemplatesError = null;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Dispute count unavailable")).toBeNull();
    expect(screen.queryByText("Response count unavailable")).toBeNull();
    expect(mockManagement.mock.lastCall?.[0].quickResponseCount).toBe(0);
  });
});
