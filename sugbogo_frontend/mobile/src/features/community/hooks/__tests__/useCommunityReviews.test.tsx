import type { PropsWithChildren } from "react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { likeReview } from "@/features/explore/api/reviewBusiness.service";
import { useReviewLike } from "@/features/explore/hooks/useReviewLike";

import { getCommunityReviews } from "../../api/communityReview.service";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReview,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../../types/communityReview.types";
import { useCommunityReviews } from "../useCommunityReviews";
import { communityReviewsKey } from "../communityReviewQueryKeys";

jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  likeReview: jest.fn(),
  unlikeReview: jest.fn(),
}));

jest.mock("../../api/communityReview.service", () => ({
  getCommunityReviews: jest.fn(),
}));

function setupClient(gcTime = 0) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime },
      mutations: { gcTime: 0 },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, Wrapper };
}

function page(
  ids: number[],
  pageNumber: number,
  hasNext: boolean,
): CommunityReviewListResponse {
  return {
    items: ids.map((id) => ({ id }) as CommunityReview),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function seedPages(client: QueryClient, count = 5) {
  const data: InfiniteData<CommunityReviewListResponse, number> = {
    pages: Array.from({ length: count }, (_, index) =>
      page([index + 1], index + 1, true),
    ),
    pageParams: Array.from({ length: count }, (_, index) => index + 1),
  };
  client.setQueryData(communityReviewsKey(), data);

  return data;
}

describe("useCommunityReviews", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("distinguishes a paused first request from a successful empty response", async () => {
    onlineManager.setOnline(false);
    (getCommunityReviews as jest.Mock).mockResolvedValue({
      success: true,
      data: page([], 1, false),
    });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasData).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(getCommunityReviews).not.toHaveBeenCalled();

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.reviews).toEqual([]);

    unmount();
    client.clear();
  });

  it("loads page one, preserves page order, and stops at the final page", async () => {
    let resolveFirstPage!: (value: {
      success: boolean;
      data: CommunityReviewListResponse;
    }) => void;
    (getCommunityReviews as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPage = resolve;
          }),
      )
      .mockResolvedValueOnce({ success: true, data: page([2], 2, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    expect(result.current.isInitialLoading).toBe(true);
    await act(async () => {
      resolveFirstPage({
        success: true,
        data: page([8, 5], 1, true),
      });
    });
    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([8, 5]),
    );
    expect(getCommunityReviews).toHaveBeenCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      1,
      expect.anything(),
    );
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        8, 5, 2,
      ]),
    );
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      2,
      expect.anything(),
    );
    expect(result.current.pages).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(getCommunityReviews).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });

  it("propagates structured API errors through React Query", async () => {
    const error = {
      success: false as const,
      message: "Community reviews are unavailable.",
      code: "COMMUNITY_UNAVAILABLE",
    };
    (getCommunityReviews as jest.Mock).mockResolvedValue(error);
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).toEqual(error));
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.reviews).toEqual([]);

    unmount();
    client.clear();
  });

  it("recovers from an initial error through refetch", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: false, message: "Offline" })
      .mockResolvedValueOnce({ success: true, data: page([8], 1, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.reviews.map((review) => review.id)).toEqual([8]);
    });

    unmount();
    client.clear();
  });

  it("retains successful pages and retries only a failed next page", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8, 5], 1, true) })
      .mockResolvedValueOnce({ success: false, message: "Offline" })
      .mockResolvedValueOnce({ success: true, data: page([2], 2, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.reviews).toHaveLength(2));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.reviews.map((review) => review.id)).toEqual([8, 5]);
    expect(result.current.pages).toHaveLength(1);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        8, 5, 2,
      ]);
    });
    expect(result.current.pages).toHaveLength(2);
    expect(getCommunityReviews).toHaveBeenCalledTimes(3);
    expect(getCommunityReviews).toHaveBeenNthCalledWith(
      3,
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      2,
      expect.anything(),
    );

    unmount();
    client.clear();
  });

  it("refreshes a one-page feed from the initial page", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8], 1, false) })
      .mockResolvedValueOnce({ success: true, data: page([9], 1, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(8));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(9));
    expect(getCommunityReviews).toHaveBeenCalledTimes(2);
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      1,
      expect.anything(),
    );

    unmount();
    client.clear();
  });

  it("preserves loaded reviews through a failed refresh and clears the error on recovery", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8], 1, false) })
      .mockResolvedValueOnce({ success: false, message: "Offline" })
      .mockResolvedValueOnce({ success: true, data: page([9], 1, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(8));
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isRefetching).toBe(false);
    });
    expect(result.current.reviews[0]?.id).toBe(8);

    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.reviews[0]?.id).toBe(9);
    });

    unmount();
    client.clear();
  });

  it("does not display another filter's pages while its request is pending", async () => {
    let resolveFiltered!: (value: unknown) => void;
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8], 1, false) })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFiltered = resolve;
        }),
      );
    const { client, Wrapper } = setupClient(Infinity);
    const filtered = {
      ...DEFAULT_COMMUNITY_REVIEW_FILTERS,
      clusterId: 3,
      hasPhotos: true,
      ordering: "most_helpful" as const,
    };
    const { result, rerender, unmount } = await renderHook<
      ReturnType<typeof useCommunityReviews>,
      { filters: CommunityReviewFilters }
    >(({ filters }) => useCommunityReviews(filters), {
      initialProps: { filters: DEFAULT_COMMUNITY_REVIEW_FILTERS },
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(8));
    await act(async () => {
      rerender({ filters: filtered });
    });
    await waitFor(() => expect(result.current.reviews).toEqual([]));
    expect(result.current.isInitialLoading).toBe(true);
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      filtered,
      1,
      expect.anything(),
    );

    await act(async () => {
      resolveFiltered({ success: true, data: page([3], 1, false) });
    });
    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(3));

    await act(async () => {
      rerender({ filters: DEFAULT_COMMUNITY_REVIEW_FILTERS });
    });
    expect(result.current.reviews[0]?.id).toBe(8);
    expect(result.current.isInitialLoading).toBe(false);

    unmount();
    client.clear();
  });

  it("configures two-minute freshness and reuses a fresh cache on remount", async () => {
    const { client, Wrapper } = setupClient(Infinity);
    seedPages(client);
    const first = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    expect(
      client.getQueryCache().find({ queryKey: communityReviewsKey() })?.options,
    ).toEqual(expect.objectContaining({ staleTime: 2 * 60 * 1000 }));
    expect(getCommunityReviews).not.toHaveBeenCalled();
    await first.unmount();
    const second = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });
    expect(second.result.current.pages).toHaveLength(5);
    expect(getCommunityReviews).not.toHaveBeenCalled();

    await act(async () => {
      await client.invalidateQueries({
        queryKey: communityReviewsKey(),
        refetchType: "none",
      });
    });
    expect(client.getQueryState(communityReviewsKey())?.isInvalidated).toBe(
      true,
    );
    expect(getCommunityReviews).not.toHaveBeenCalled();

    await second.unmount();
    client.clear();
  });

  it("keeps five pages pending, replaces only on success, and restarts pagination", async () => {
    const response = deferred<{
      success: true;
      data: CommunityReviewListResponse;
    }>();
    (getCommunityReviews as jest.Mock)
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce({ success: true, data: page([90], 2, false) });
    const { client, Wrapper } = setupClient(Infinity);
    seedPages(client);
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });
    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.refresh();
      expect(result.current.refresh()).toBe(refreshPromise);
    });
    await waitFor(() => expect(getCommunityReviews).toHaveBeenCalledTimes(1));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.pages).toHaveLength(5);
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      1,
      expect.anything(),
    );

    await act(async () => {
      response.resolve({ success: true, data: page([80], 1, true) });
      await refreshPromise;
    });
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.isRefreshing).toBe(false);
    expect(client.getQueryData(communityReviewsKey())).toEqual({
      pages: [page([80], 1, true)],
      pageParams: [1],
    });
    await waitFor(() => {
      expect(
        client.getQueryCache().find({ queryKey: communityReviewsKey() })
          ?.options,
      ).toEqual(expect.objectContaining({ staleTime: 2 * 60 * 1000 }));
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      2,
      expect.anything(),
    );
    await waitFor(() => {
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        80, 90,
      ]);
    });
    expect(client.getQueryData(communityReviewsKey())).toEqual({
      pages: [page([80], 1, true), page([90], 2, false)],
      pageParams: [1, 2],
    });
    await unmount();
    client.clear();
  });

  it("preserves every retained page on refresh failure and clears the error on retry", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: false, message: "Unavailable" })
      .mockResolvedValueOnce({ success: true, data: page([80], 1, false) });
    const { client, Wrapper } = setupClient(Infinity);
    const original = seedPages(client);
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.isFetchNextPageError).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(client.getQueryData(communityReviewsKey())).toBe(original);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.reviews.map((review) => review.id)).toEqual([80]);
    expect(getCommunityReviews).toHaveBeenCalledTimes(2);
    await unmount();
    client.clear();
  });

  it("cancels pagination for refresh and ignores its late result", async () => {
    const nextPage = deferred<unknown>();
    const freshPage = deferred<unknown>();
    (getCommunityReviews as jest.Mock)
      .mockReturnValueOnce(nextPage.promise)
      .mockReturnValueOnce(freshPage.promise);
    const { client, Wrapper } = setupClient(Infinity);
    seedPages(client, 2);
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });
    let nextPromise!: ReturnType<typeof result.current.fetchNextPage>;
    await act(async () => {
      nextPromise = result.current.fetchNextPage();
    });
    const nextSignal = (getCommunityReviews as jest.Mock).mock
      .calls[0][2] as AbortSignal;
    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.refresh();
    });
    await waitFor(() => expect(getCommunityReviews).toHaveBeenCalledTimes(2));
    expect(nextSignal.aborted).toBe(true);
    expect(result.current.fetchNextPage()).toBe(refreshPromise);
    expect(result.current.error).toBeNull();
    expect(result.current.isFetchNextPageError).toBe(false);

    await act(async () => {
      freshPage.resolve({ success: true, data: page([80], 1, true) });
      await refreshPromise;
      nextPage.resolve({ success: true, data: page([99], 3, false) });
      await nextPromise;
    });
    expect(result.current.reviews.map((review) => review.id)).toEqual([80]);
    expect(result.current.error).toBeNull();
    expect(client.getQueryData(communityReviewsKey())).toEqual({
      pages: [page([80], 1, true)],
      pageParams: [1],
    });
    await unmount();
    client.clear();
  });

  it("cancels a superseded filter request without exposing an error", async () => {
    const oldResponse = deferred<unknown>();
    (getCommunityReviews as jest.Mock)
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce({ success: true, data: page([80], 1, false) });
    const { client, Wrapper } = setupClient(Infinity);
    const { result, rerender, unmount } = await renderHook(
      ({ filters }: { filters: CommunityReviewFilters }) =>
        useCommunityReviews(filters),
      {
        initialProps: { filters: DEFAULT_COMMUNITY_REVIEW_FILTERS },
        wrapper: Wrapper,
      },
    );
    const oldSignal = (getCommunityReviews as jest.Mock).mock
      .calls[0][2] as AbortSignal;
    await rerender({
      filters: { ...DEFAULT_COMMUNITY_REVIEW_FILTERS, hasPhotos: true },
    });
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(80));
    await act(async () => {
      oldResponse.resolve({ success: true, data: page([99], 1, false) });
    });
    expect(result.current.reviews[0]?.id).toBe(80);
    expect(result.current.error).toBeNull();
    expect(client.getQueryState(communityReviewsKey())?.error).toBeNull();
    await unmount();
    client.clear();
  });

  it("cancels an old filter's explicit refresh without replacing either cache", async () => {
    const oldResponse = deferred<unknown>();
    (getCommunityReviews as jest.Mock)
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce({ success: true, data: page([80], 1, false) });
    const { client, Wrapper } = setupClient(Infinity);
    const original = seedPages(client);
    const { result, rerender, unmount } = await renderHook(
      ({ filters }: { filters: CommunityReviewFilters }) =>
        useCommunityReviews(filters),
      {
        initialProps: { filters: DEFAULT_COMMUNITY_REVIEW_FILTERS },
        wrapper: Wrapper,
      },
    );
    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.refresh();
    });
    await waitFor(() => expect(getCommunityReviews).toHaveBeenCalledTimes(1));
    const oldSignal = (getCommunityReviews as jest.Mock).mock
      .calls[0][2] as AbortSignal;
    await rerender({
      filters: { ...DEFAULT_COMMUNITY_REVIEW_FILTERS, hasPhotos: true },
    });
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(80));
    await act(async () => {
      oldResponse.resolve({ success: true, data: page([99], 1, false) });
      await refreshPromise;
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reviews[0]?.id).toBe(80);
    expect(client.getQueryData(communityReviewsKey())).toBe(original);
    await unmount();
    client.clear();
  });

  it("waits for pending Helpful writes before reading fresh page one", async () => {
    const likeResponse = deferred<unknown>();
    (likeReview as jest.Mock).mockReturnValueOnce(likeResponse.promise);
    const review = {
      id: 8,
      is_liked: false,
      like_count: 2,
      is_liked_by_owner: false,
    } as CommunityReview;
    const firstPage = { ...page([], 1, true), items: [review] };
    const freshPage = {
      ...firstPage,
      items: [{ ...review, is_liked: true, like_count: 3 }],
    };
    (getCommunityReviews as jest.Mock).mockResolvedValue({
      success: true,
      data: freshPage,
    });
    const { client, Wrapper } = setupClient(Infinity);
    client.setQueryData(communityReviewsKey(), {
      pages: [firstPage, page([20], 2, false)],
      pageParams: [1, 2],
    });
    const { result, unmount } = await renderHook(
      () => ({
        community: useCommunityReviews(),
        helpful: useReviewLike(12, 8),
      }),
      { wrapper: Wrapper },
    );
    let likePromise!: Promise<unknown>;
    await act(async () => {
      likePromise = result.current.helpful.mutateAsync({
        reviewId: 8,
        isLiked: false,
      });
    });
    await waitFor(() =>
      expect(result.current.community.reviews[0].is_liked).toBe(true),
    );
    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.community.refresh();
    });
    expect(getCommunityReviews).not.toHaveBeenCalled();
    expect(result.current.community.isRefreshing).toBe(true);

    await act(async () => {
      likeResponse.resolve({
        success: true,
        data: { review_id: 8, is_liked: true },
      });
      await likePromise;
      await refreshPromise;
    });
    expect(result.current.community.reviews[0].is_liked).toBe(true);
    expect(result.current.community.reviews[0].like_count).toBe(3);
    expect(client.getQueryData(communityReviewsKey())).toEqual({
      pages: [freshPage],
      pageParams: [1],
    });
    await unmount();
    client.clear();
  });
});
