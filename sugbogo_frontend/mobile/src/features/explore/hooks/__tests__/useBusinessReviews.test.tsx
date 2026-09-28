import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  createReview,
  deleteReview,
  getAllBusinessReviews,
  getBusinessReviewPreview,
  reportReview,
  updateReview,
} from "../../api/reviewBusiness.service";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReview,
  type BusinessReviewFilters,
  type BusinessReviewListResponse,
} from "../../types/review.types";
import {
  useBusinessReviewPreview,
  useBusinessReviews,
  useCreateReview,
  useDeleteReview,
  useMerchantBusinessReviews,
  useReportReview,
  useUpdateReview,
} from "../useBusinessReviews";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "../reviewQueryKeys";
import { DISCOVERY_FEED_QUERY_KEY } from "../useDiscoveryFeed";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "../useExploreCollection";

const mockStartSentimentSync = jest.fn();
const mockStartGeneratedInsightsSync = jest.fn();

jest.mock("../../api/reviewBusiness.service", () => ({
  createReview: jest.fn(),
  deleteReview: jest.fn(),
  getAllBusinessReviews: jest.fn(),
  getBusinessReviewPreview: jest.fn(),
  reportReview: jest.fn(),
  updateReview: jest.fn(),
}));

jest.mock("../ReviewDerivedDataSyncProvider", () => ({
  useReviewDerivedDataSyncActions: () => ({
    startSentimentSync: mockStartSentimentSync,
    startGeneratedInsightsSync: mockStartGeneratedInsightsSync,
  }),
}));

function setupClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  /** Supplies review hooks with isolated query state. */
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
): BusinessReviewListResponse {
  return {
    items: ids.map((id) => ({ id }) as BusinessReview),
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

describe("useBusinessReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts at page one, flattens server order, and stops after the last page", async () => {
    (getAllBusinessReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8, 5], 1, true) })
      .mockResolvedValueOnce({ success: true, data: page([2], 2, false) });
    const { client, Wrapper } = setupClient();
    const filters = {
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      sentiment: "positive",
    } as BusinessReviewFilters;
    const { result, unmount } = await renderHook(
      () => useBusinessReviews(20, filters),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([8, 5]),
    );
    expect(getAllBusinessReviews).toHaveBeenCalledWith(20, filters, 1);
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
    expect(getAllBusinessReviews).toHaveBeenLastCalledWith(20, filters, 2);
    expect(result.current.hasNextPage).toBe(false);
    unmount();
    client.clear();
  });

  it("keeps prior reviews visible while a new filter request loads", async () => {
    let resolveFiltered!: (value: unknown) => void;
    const filteredRequest = new Promise((resolve) => {
      resolveFiltered = resolve;
    });
    (getAllBusinessReviews as jest.Mock).mockImplementation(
      (_businessId, filters) =>
        filters?.sentiment
          ? filteredRequest
          : Promise.resolve({ success: true, data: page([8, 5], 1, true) }),
    );
    const { client, Wrapper } = setupClient();
    let filters = DEFAULT_BUSINESS_REVIEW_FILTERS;
    const { result, rerender, unmount } = await renderHook(
      () => useBusinessReviews(20, filters),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.reviews).toHaveLength(2));

    filters = { ...filters, sentiment: "negative" };
    await rerender({});

    expect(result.current.reviews.map((review) => review.id)).toEqual([8, 5]);
    expect(result.current.isPlaceholderData).toBe(true);

    await act(async () => {
      resolveFiltered({ success: true, data: page([3], 1, false) });
    });
    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([3]),
    );
    unmount();
    client.clear();
  });

  it("gets the user's review from preview metadata, not loaded list pages", async () => {
    const ownReview = { id: 1, is_own_review: true } as BusinessReview;
    (getBusinessReviewPreview as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        reviews: [{ id: 9 }, { id: 8 }, { id: 7 }],
        total_count: 12,
        user_review: ownReview,
      },
    });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useBusinessReviewPreview(20),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.userReview?.id).toBe(1));
    expect(result.current.hasOwnReview).toBe(true);
    expect(result.current.totalCount).toBe(12);
    unmount();
    client.clear();
  });

  it("keeps merchant review management's complete collection available", async () => {
    (getAllBusinessReviews as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: page([8, 5], 1, true) })
      .mockResolvedValueOnce({ success: true, data: page([2], 2, false) });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useMerchantBusinessReviews(20),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.reviews.map((review) => review.id)).toEqual([
        8, 5, 2,
      ]),
    );
    expect(getAllBusinessReviews).toHaveBeenNthCalledWith(
      1,
      20,
      undefined,
      1,
      100,
    );
    expect(getAllBusinessReviews).toHaveBeenNthCalledWith(
      2,
      20,
      undefined,
      2,
      100,
    );
    expect(result.current.totalCount).toBe(3);
    unmount();
    client.clear();
  });

  it("refreshes review insights after a successful deletion", async () => {
    (deleteReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { review_id: 8 },
    });
    const { client, Wrapper } = setupClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(() => useDeleteReview(20), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 8 });
    });

    expect(deleteReview).toHaveBeenCalledWith(8);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: businessReviewPreviewKey(20),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: businessReviewsKey(20),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: DISCOVERY_FEED_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: EXPLORE_COLLECTIONS_QUERY_KEY,
    });
    expect(mockStartSentimentSync).not.toHaveBeenCalled();
    expect(mockStartGeneratedInsightsSync).toHaveBeenCalledWith({
      baselineGeneratedAt: null,
      baselineUpdatedAt: null,
      baselineState: null,
      resultNotBefore: expect.any(Number),
      startedAt: expect.any(Number),
    });
    unmount();
    client.clear();
  });

  it("starts sentiment synchronization after review creation", async () => {
    (createReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 18, business_id: 20, user_id: 4 },
    });
    const { client, Wrapper } = setupClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(() => useCreateReview(20), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        text: "A detailed review for sentiment processing.",
        photos: [],
      });
    });

    expect(mockStartSentimentSync).toHaveBeenCalledWith({
      reviewId: 18,
      baselineComputedAt: null,
      baselineGeneratedAt: null,
      baselineInsightsUpdatedAt: null,
      baselineInsightsState: null,
      startedAt: expect.any(Number),
    });
    expect(mockStartGeneratedInsightsSync).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: DISCOVERY_FEED_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: EXPLORE_COLLECTIONS_QUERY_KEY,
    });
    unmount();
    client.clear();
  });

  it("starts sentiment synchronization only when edited text changed", async () => {
    (updateReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 8 },
    });
    const { client, Wrapper } = setupClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(() => useUpdateReview(20), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        reviewId: 8,
        text: "The same review text.",
        photos: [{ uri: "file:///photo.jpg" }],
        keepPhotoIds: [],
        textChanged: false,
      });
    });
    expect(mockStartSentimentSync).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.mutateAsync({
        reviewId: 8,
        text: "A changed review text for new sentiment.",
        photos: [],
        keepPhotoIds: [],
        textChanged: true,
      });
    });

    expect(mockStartSentimentSync).toHaveBeenCalledWith({
      reviewId: 8,
      baselineComputedAt: null,
      baselineGeneratedAt: null,
      baselineInsightsUpdatedAt: null,
      baselineInsightsState: null,
      startedAt: expect.any(Number),
    });
    expect(mockStartGeneratedInsightsSync).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: DISCOVERY_FEED_QUERY_KEY,
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: EXPLORE_COLLECTIONS_QUERY_KEY,
    });
    unmount();
    client.clear();
  });

  it("does not start synchronization for unrelated review mutations", async () => {
    (reportReview as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
    const { client, Wrapper } = setupClient();
    const { result, unmount } = await renderHook(
      () => useReportReview(20),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        reviewId: 8,
        reportType: "spam",
      });
    });

    expect(mockStartSentimentSync).not.toHaveBeenCalled();
    expect(mockStartGeneratedInsightsSync).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
