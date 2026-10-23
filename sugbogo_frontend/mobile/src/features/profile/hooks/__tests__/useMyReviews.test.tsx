import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import { getMyReviews } from "../../api/myReviews.service";
import type { MyReviewPage, MyReview } from "../../types/myReview.types";
import { useMyReviews, myReviewsKey } from "../useMyReviews";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { businessReviewsKey } from "@/features/explore/hooks/reviewQueryKeys";
import { getBusinessReviewPreview } from "@/features/explore/api/reviewBusiness.service";

jest.mock("../../api/myReviews.service", () => ({ getMyReviews: jest.fn() }));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));

function page(ids: number[], pageNumber = 1, hasNext = false): MyReviewPage {
  return {
    items: ids.map((id) => ({ id }) as MyReview),
    pagination: {
      page: pageNumber,
      page_size: 2,
      total_items: 3,
      total_pages: 2,
      has_next: hasNext,
      has_previous: pageNumber > 1,
    },
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  /** Supplies isolated query state while retaining the real auth store. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, Wrapper };
}

describe("useMyReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 10 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("observes publication from private history and schedules business synchronization once", async () => {
    let current = page([18]);
    current.items[0] = {
      ...current.items[0],
      status: "under_review",
      business: { id: 20 },
    } as MyReview;
    (getMyReviews as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: current,
    }));
    const { client, Wrapper } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.reviews[0]?.status).toBe("under_review"),
    );
    current = {
      ...current,
      items: [{ ...current.items[0], status: "published" }],
    };
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.publishedBusinessIds).toEqual([20]),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: myReviewsKey(10) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: businessReviewsKey(20),
    });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.publishedBusinessIds).toEqual([20]);
    await unmount();
    client.clear();
  });

  it("reconciles a published review disappearing from the held-only filter", async () => {
    let current = page([18]);
    current.items[0] = {
      ...current.items[0],
      status: "under_review",
      business: { id: 20 },
    } as MyReview;
    (getMyReviews as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: current,
    }));
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: {
        reviews: [],
        total_count: 1,
        user_review: { id: 18, status: "published" } as never,
      },
    });
    const { client, Wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => useMyReviews("under_review"),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.reviews[0]?.status).toBe("under_review"),
    );
    current = { ...current, items: [] };
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.publishedBusinessIds).toEqual([20]),
    );
    expect(getBusinessReviewPreview).toHaveBeenCalledWith(20);
    await unmount();
    client.clear();
  });

  it("paginates in backend order, deduplicates overlaps, and uses server totals", async () => {
    (getMyReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([9, 8], 1, true) })
      .mockResolvedValueOnce({ success: true, data: page([8, 7], 2) });
    const { Wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(2));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        9, 8, 7,
      ]),
    );
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasNextPage).toBe(false);
    expect(getMyReviews).toHaveBeenNthCalledWith(2, 2, "all", "newest");
    expect(client.getQueryData(myReviewsKey(10))).toBeDefined();
    await act(async () => {
      await unmount();
      client.clear();
    });
  });

  it("does not display the previous account's history during account switching or sign-out", async () => {
    (getMyReviews as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: page([9]),
    });
    const { Wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    (getMyReviews as jest.Mock).mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      useAuthStore.setState({ user: { id: 20 } as User });
    });
    expect(result.current.reviews).toEqual([]);
    expect(myReviewsKey(20)).not.toEqual(myReviewsKey(10));
    await act(async () => {
      useAuthStore.getState().clearUser();
    });
    expect(result.current.reviews).toEqual([]);
    expect(result.current.isEnabled).toBe(false);
    await act(async () => {
      await unmount();
      client.clear();
    });
  });

  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: { id: 10 } as User, isAuthenticated: true, isLoading: true },
  ])("disables requests for unavailable auth state %#", async (state) => {
    useAuthStore.setState(state);
    const { Wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.refetch();
    });
    expect(getMyReviews).not.toHaveBeenCalled();
    expect(result.current.reviews).toEqual([]);
    await act(async () => {
      await unmount();
      client.clear();
    });
  });

  it("exposes API errors and recovers with refetch", async () => {
    (getMyReviews as jest.Mock)
      .mockResolvedValueOnce({
        success: false,
        message: "Unavailable",
        code: "SERVER_ERROR",
      })
      .mockResolvedValueOnce({ success: true, data: page([9]) });
    const { Wrapper, client } = setup();
    const { result, unmount } = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    expect(result.current.error).toBeNull();
    await act(async () => {
      await unmount();
      client.clear();
    });
  });
});
