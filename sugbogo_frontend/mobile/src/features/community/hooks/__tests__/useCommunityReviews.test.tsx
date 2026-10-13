import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getCommunityReviews } from "../../api/communityReview.service";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReview,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../../types/communityReview.types";
import { useCommunityReviews } from "../useCommunityReviews";

jest.mock("../../api/communityReview.service", () => ({
  getCommunityReviews: jest.fn(),
}));

function setupClient(gcTime = 0) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime } },
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

describe("useCommunityReviews", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("loads page one, preserves page order, and stops at the final page", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8, 5], 1, true) })
      .mockResolvedValueOnce({ success: true, data: page([2], 2, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    expect(result.current.isInitialLoading).toBe(true);
    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([8, 5]),
    );
    expect(getCommunityReviews).toHaveBeenCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      1,
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
    );

    unmount();
    client.clear();
  });

  it("refetches the first page for pull-to-refresh", async () => {
    (getCommunityReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8], 1, false) })
      .mockResolvedValueOnce({ success: true, data: page([9], 1, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(() => useCommunityReviews(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(8));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.reviews[0]?.id).toBe(9));
    expect(getCommunityReviews).toHaveBeenCalledTimes(2);
    expect(getCommunityReviews).toHaveBeenLastCalledWith(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      1,
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
      await result.current.refetch();
    });
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isRefetching).toBe(false);
    });
    expect(result.current.reviews[0]?.id).toBe(8);

    await act(async () => {
      await result.current.refetch();
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
    expect(getCommunityReviews).toHaveBeenLastCalledWith(filtered, 1);

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
});
