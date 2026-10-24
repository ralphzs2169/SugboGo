import type { PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  deleteReview,
  getBusinessReviewPreview,
} from "@/features/explore/api/reviewBusiness.service";
import {
  useBusinessReviewPreview,
  useDeleteReview,
} from "@/features/explore/hooks/useBusinessReviews";
import type {
  BusinessReview,
  BusinessReviewPreview,
} from "@/features/explore/types/review.types";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "@/features/explore/hooks/reviewQueryKeys";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { getMyReviews } from "../../api/myReviews.service";
import type { MyReview, MyReviewPage } from "../../types/myReview.types";
import { myReviewsKey } from "../myReviewQueryKeys";
import { useMyReviews } from "../useMyReviews";

jest.mock("../../api/myReviews.service", () => ({ getMyReviews: jest.fn() }));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  deleteReview: jest.fn(),
  getBusinessReviewPreview: jest.fn(),
}));
jest.mock("@/features/explore/hooks/ReviewDerivedDataSyncProvider", () => ({
  useReviewDerivedDataSyncActions: () => ({
    startSentimentSync: jest.fn(),
    startGeneratedInsightsSync: jest.fn(),
  }),
}));

let retainedIds: number[];

function page(pageNumber: number): MyReviewPage {
  return {
    items: retainedIds
      .slice((pageNumber - 1) * 2, pageNumber * 2)
      .map((id) => ({ id }) as MyReview),
    pagination: {
      page: pageNumber,
      page_size: 2,
      total_items: retainedIds.length,
      total_pages: Math.ceil(retainedIds.length / 2),
      has_next: pageNumber * 2 < retainedIds.length,
      has_previous: pageNumber > 1,
    },
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  /** Uses real history and mutation hooks against isolated query state. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, Wrapper };
}

describe("confirmed deletion and private infinite history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retainedIds = [5, 4, 3, 2, 1];
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    (getMyReviews as jest.Mock).mockImplementation(async (pageNumber) => ({
      success: true,
      data: page(pageNumber),
    }));
    (deleteReview as jest.Mock).mockImplementation(async (id) => {
      retainedIds = retainedIds.filter((current) => current !== id);
      return { success: true, data: { review_id: id } };
    });
  });

  it("clears resolved ownership after confirmed deletion even if the preview refresh fails", async () => {
    const ownReview: BusinessReview = {
      id: 5,
      text: "My published review",
      status: "published",
      author: {
        id: 10,
        first_name: "Ana",
        last_name: "Cruz",
        avatar_url: null,
      },
      created_at: "2026-10-01T12:00:00Z",
      updated_at: "2026-10-01T12:00:00Z",
      photos: [],
      vouched_specialties: [],
      reply: null,
      like_count: 0,
      sentiment_label: null,
      sentiment_score: null,
      is_liked: false,
      is_liked_by_owner: false,
      is_own_review: true,
      has_reported: false,
      active_dispute_id: null,
    };
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Review preview retrieved.",
      data: { reviews: [ownReview], user_review: ownReview, total_count: 1 },
    });
    const { client, Wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => ({
        preview: useBusinessReviewPreview(20),
        deletion: useDeleteReview(20),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.preview.hasOwnReview).toBe(true));
    expect(result.current.preview.hasResolvedOwnership).toBe(true);
    jest
      .mocked(getBusinessReviewPreview)
      .mockRejectedValue(new Error("Offline"));
    await act(async () => {
      await result.current.deletion.mutateAsync({ reviewId: 5 });
    });
    expect(result.current.preview.hasOwnReview).toBe(false);
    expect(result.current.preview.hasResolvedOwnership).toBe(true);
    expect(result.current.preview.userReview).toBeNull();
    expect(
      client.getQueryData<BusinessReviewPreview>(businessReviewPreviewKey(20)),
    ).toEqual({
      reviews: [],
      user_review: null,
      total_count: 1,
    });
    await unmount();
    client.clear();
  });

  it("refetches a shortened collection without requesting an obsolete last page", async () => {
    const { client, Wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => ({ history: useMyReviews(), deletion: useDeleteReview(20) }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.history.reviews).toHaveLength(2));
    await act(async () => {
      await result.current.history.fetchNextPage();
    });
    await act(async () => {
      await result.current.history.fetchNextPage();
    });
    await waitFor(() => expect(result.current.history.reviews).toHaveLength(5));
    await act(async () => {
      await result.current.deletion.mutateAsync({ reviewId: 1 });
    });
    await waitFor(() => expect(result.current.history.totalCount).toBe(4));
    expect(result.current.history.reviews.map((review) => review.id)).toEqual([
      5, 4, 3, 2,
    ]);
    expect(result.current.history.data?.pageParams).toEqual([1, 2]);
    expect(result.current.history.data?.pages).toHaveLength(2);
    expect(result.current.history.hasNextPage).toBe(false);
    expect(
      (getMyReviews as jest.Mock).mock.calls.map(([pageNumber]) => pageNumber),
    ).toEqual([1, 2, 3, 1, 2]);
    await unmount();
    client.clear();
  });

  it("removes confirmed content from inactive business and Community caches without fabricating totals", async () => {
    const { client, Wrapper } = setup();
    const cached: InfiniteData<MyReviewPage> = {
      pages: [page(1)],
      pageParams: [1],
    };
    const preview = {
      reviews: [{ id: 5 }, { id: 4 }],
      user_review: { id: 5 },
      total_count: 2,
    };
    const merchantKey = [...businessReviewsKey(20), "merchant-all"];
    const filteredKey = [...businessReviewsKey(20), { hasPhotos: true }];
    const communityKey = [...COMMUNITY_REVIEWS_QUERY_KEY, { hasPhotos: true }];
    client.setQueryData(businessReviewPreviewKey(20), preview);
    client.setQueryData(businessReviewPreviewKey(21), preview);
    client.setQueryData(businessReviewsKey(20), cached);
    client.setQueryData(filteredKey, cached);
    client.setQueryData(merchantKey, {
      reviews: [{ id: 5 }, { id: 4 }],
      totalCount: 2,
    });
    client.setQueryData(communityKey, cached);
    const { result, unmount } = await renderHook(() => useDeleteReview(20), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ reviewId: 5 });
    });
    expect(client.getQueryData(businessReviewPreviewKey(20))).toEqual({
      reviews: [{ id: 4 }],
      user_review: null,
      total_count: 2,
    });
    expect(client.getQueryData(businessReviewPreviewKey(21))).toEqual(preview);
    expect(client.getQueryData(merchantKey)).toEqual({
      reviews: [{ id: 4 }],
      totalCount: 2,
    });
    for (const key of [businessReviewsKey(20), filteredKey, communityKey]) {
      const current = client.getQueryData<InfiniteData<MyReviewPage>>(key);
      expect(current?.pages[0].items.map((review) => review.id)).toEqual([4]);
      expect(current?.pageParams).toEqual(cached.pageParams);
      expect(current?.pages[0].pagination).toEqual(cached.pages[0].pagination);
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
    await unmount();
    client.clear();
  });

  it("keeps confirmed removal when history refresh fails, preserving metadata until an authoritative retry", async () => {
    const { client, Wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => ({ history: useMyReviews(), deletion: useDeleteReview(20) }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.history.reviews).toHaveLength(2));
    const pagination = result.current.history.data?.pages[0].pagination;
    (getMyReviews as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.deletion.mutateAsync({ reviewId: 5 });
    });
    await waitFor(() => expect(result.current.history.error).toBeTruthy());
    expect(result.current.history.reviews.map((review) => review.id)).toEqual([
      4,
    ]);
    expect(result.current.history.data?.pages[0].pagination).toEqual(
      pagination,
    );
    expect(result.current.history.data?.pageParams).toEqual([1]);
    await act(async () => {
      await result.current.history.refetch();
    });
    await waitFor(() => expect(result.current.history.totalCount).toBe(4));
    expect(result.current.history.reviews.map((review) => review.id)).toEqual([
      4, 3,
    ]);
    await unmount();
    client.clear();
  });

  it("ignores a pre-deletion history response that finishes after successful deletion", async () => {
    const { client, Wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => ({ history: useMyReviews(), deletion: useDeleteReview(20) }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.history.reviews).toHaveLength(2));
    const oldPage = page(1);
    let finishOldRequest!: (value: unknown) => void;
    (getMyReviews as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldRequest = resolve;
        }),
    );
    await act(async () => {
      void result.current.history.refetch();
    });
    await act(async () => {
      await result.current.deletion.mutateAsync({ reviewId: 5 });
    });
    await waitFor(() =>
      expect(result.current.history.reviews.map((review) => review.id)).toEqual(
        [4, 3],
      ),
    );
    await act(async () => {
      finishOldRequest({ success: true, data: oldPage });
    });
    expect(
      client
        .getQueryData<InfiniteData<MyReviewPage>>(myReviewsKey(10))
        ?.pages[0].items.map((review) => review.id),
    ).toEqual([4, 3]);
    await unmount();
    client.clear();
  });

  it("ignores a deletion response after the submitting account's session changes", async () => {
    const { client, Wrapper } = setup();
    const cached: InfiniteData<MyReviewPage> = {
      pages: [page(1)],
      pageParams: [1],
    };
    client.setQueryData(myReviewsKey(10), cached);
    client.setQueryData(myReviewsKey(99), cached);
    const invalidate = jest.spyOn(client, "invalidateQueries");
    let finishDelete!: (value: unknown) => void;
    (deleteReview as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve;
        }),
    );
    const { result, unmount } = await renderHook(() => useDeleteReview(20), {
      wrapper: Wrapper,
    });
    let saving!: Promise<{ review_id: number }>;
    await act(async () => {
      saving = result.current.mutateAsync({ reviewId: 5 });
    });
    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith(5));
    await act(async () => {
      useAuthStore.setState({ user: { id: 99 } as never });
      finishDelete({ success: true, data: { review_id: 5 } });
      await saving;
    });
    expect(client.getQueryData(myReviewsKey(10))).toEqual(cached);
    expect(client.getQueryData(myReviewsKey(99))).toEqual(cached);
    expect(invalidate).not.toHaveBeenCalled();
    await unmount();
    client.clear();
  });
});
