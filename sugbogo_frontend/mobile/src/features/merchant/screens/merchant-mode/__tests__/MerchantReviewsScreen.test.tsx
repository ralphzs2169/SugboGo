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

const mockRouter = { setParams: jest.fn() };
let mockParams: Record<string, unknown> = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@gorhom/bottom-sheet", () => ({}));
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
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: { id: 8 },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../../hooks/review-disputes/useReviewDisputes", () => ({
  useReviewDisputes: () => ({ disputes: [], isLoading: false }),
}));
jest.mock("../../../hooks/reply-templates/useReplyTemplates", () => ({
  useReplyTemplates: () => ({ templates: [], isLoading: false }),
}));
jest.mock(
  "../../../components/review-management/MerchantReviewManagement",
  () => ({ __esModule: true, default: () => null }),
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
jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantUnansweredReviews: jest.fn(),
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
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    mockParams = {
      filter: "needs-reply",
      ordering: "oldest",
      reviewIntent: "1",
    };
    mockRouter.setParams.mockClear();
    getReviews.mockReset().mockResolvedValue(response([1]));
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
  async function openScreen() {
    return render(
      <QueryClientProvider client={client}>
        <MerchantReviewsScreen />
      </QueryClientProvider>,
    );
  }

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
    await fireEvent.press(screen.getByRole("button", { name: "All" }));
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
      screen.getByRole("button", { name: "Clear review filters" }),
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
    await fireEvent.press(screen.getByRole("button", { name: "Replied" }));
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
});
