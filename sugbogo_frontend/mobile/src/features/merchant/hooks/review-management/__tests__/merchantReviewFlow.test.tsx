import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAllBusinessReviews } from "@/features/explore/api/reviewBusiness.service";
import type {
  BusinessReview,
  BusinessReviewListResponse,
} from "@/features/explore/types/review.types";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import useMerchantReviewSelection from "../useMerchantReviewSelection";
import useMerchantReviewFeed from "../useMerchantReviewFeed";

let mockParams: Record<string, unknown> = {};
const mockRouter = { setParams: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  getAllBusinessReviews: jest.fn(),
}));
const getReviews = jest.mocked(getAllBusinessReviews);

function page(
  ids: number[],
  current = 1,
  next = false,
): BusinessReviewListResponse {
  return {
    items: ids.map((id) => ({ id }) as BusinessReview),
    pagination: {
      page: current,
      page_size: 1,
      total_items: next ? 2 : current,
      total_pages: next ? 2 : current,
      has_next: next,
      has_previous: current > 1,
    },
  };
}

describe("merchant review entry intent and server pagination", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function useFlow() {
    const selection = useMerchantReviewSelection();
    const feed = useMerchantReviewFeed(
      20,
      selection.filter,
      selection.ordering,
    );
    return { selection, feed };
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    mockParams = {};
    mockRouter.setParams.mockClear();
    getReviews.mockReset().mockResolvedValue({
      success: true,
      message: "Success",
      data: page([1]),
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("resets filters for a notification and consumes its target without losing it", async () => {
    mockParams = { reviewId: "42", filter: "replied", ordering: "oldest" };
    const { result, rerender } = await renderHook(
      () => useMerchantReviewSelection(),
      { wrapper: Wrapper },
    );
    expect(result.current.reviewId).toBe(42);
    expect(result.current.filter).toBe("all");
    expect(result.current.ordering).toBe("newest");
    const firstEntry = result.current.entry;
    mockParams = {};
    await rerender({});
    expect(result.current.reviewId).toBe(42);
    await act(async () => result.current.setFilter("needs-reply"));
    expect(result.current.reviewId).toBeNull();
    mockParams = { reviewId: "42", filter: "all", ordering: "newest" };
    await rerender({});
    expect(result.current.reviewId).toBe(42);
    expect(result.current.entry).toBeGreaterThan(firstEntry);
  });

  it("applies the route intent before the first request and permits manual changes and repeated entry", async () => {
    mockParams = {
      filter: "needs-reply",
      ordering: "oldest",
      reviewIntent: "1",
    };
    const { result, rerender } = await renderHook(() => useFlow(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.feed.reviews).toHaveLength(1));
    expect(getReviews).toHaveBeenCalledTimes(1);
    expect(getReviews).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        needsReply: true,
        merchantReplied: false,
        ordering: "oldest",
      }),
      1,
    );
    expect(mockRouter.setParams).toHaveBeenCalledWith({
      filter: undefined,
      ordering: undefined,
      reviewIntent: undefined,
    });
    await act(async () => result.current.selection.setFilter("all"));
    await waitFor(() => expect(getReviews).toHaveBeenCalledTimes(2));
    expect(result.current.selection.filter).toBe("all");
    expect(getReviews).toHaveBeenLastCalledWith(
      20,
      expect.objectContaining({ needsReply: false, ordering: "oldest" }),
      1,
    );
    mockParams = {};
    await rerender({});
    await act(async () => result.current.selection.setOrdering("newest"));
    await waitFor(() =>
      expect(getReviews).toHaveBeenLastCalledWith(
        20,
        expect.objectContaining({ needsReply: false, ordering: "newest" }),
        1,
      ),
    );
    mockParams = {
      filter: "needs-reply",
      ordering: "oldest",
      reviewIntent: "2",
    };
    await rerender({});
    expect(result.current.selection.filter).toBe("needs-reply");
    expect(result.current.selection.ordering).toBe("oldest");
  });

  it("discards unsupported or array-valued route parameters", async () => {
    mockParams = { filter: ["needs-reply"], ordering: "random" };
    const { result } = await renderHook(() => useFlow(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.feed.reviews).toHaveLength(1));
    expect(result.current.selection.filter).toBe("all");
    expect(getReviews).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ needsReply: false, ordering: "newest" }),
      1,
    );
    expect(mockRouter.setParams).toHaveBeenCalled();
  });

  it("fetches later pages only on demand and preserves loaded rows when a page fails", async () => {
    getReviews.mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: page([1], 1, true),
    });
    const { result } = await renderHook(
      () => useMerchantReviewFeed(20, "needs-reply", "oldest"),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(getReviews).toHaveBeenCalledTimes(1);
    getReviews.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.reviews.map((review) => review.id)).toEqual([1]);
    getReviews.mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: page([2], 2),
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([1, 2]),
    );
    expect(getReviews).toHaveBeenLastCalledWith(
      20,
      expect.objectContaining({ needsReply: true, ordering: "oldest" }),
      2,
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("does not show the previous account's rows after an account switch", async () => {
    const { result } = await renderHook(
      () => useMerchantReviewFeed(20, "needs-reply", "oldest"),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    getReviews.mockReturnValueOnce(new Promise(() => {}));
    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(43) }),
    );
    await waitFor(() => expect(getReviews).toHaveBeenCalledTimes(2));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.totalCount).toBeUndefined();
  });
});
