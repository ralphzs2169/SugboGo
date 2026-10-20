import type { PropsWithChildren } from "react";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getCommunityReviews } from "@/features/community/api/communityReview.service";
import { communityReviewsKey } from "@/features/community/hooks/communityReviewQueryKeys";
import { useCommunityReviews } from "@/features/community/hooks/useCommunityReviews";
import type {
  CommunityReview,
  CommunityReviewListResponse,
} from "@/features/community/types/communityReview.types";

import { likeReview, unlikeReview } from "../../api/reviewBusiness.service";
import type {
  BusinessReview,
  BusinessReviewListResponse,
  BusinessReviewPreview,
} from "../../types/review.types";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "../reviewQueryKeys";
import { useReviewLike } from "../useReviewLike";

jest.mock("../../api/reviewBusiness.service", () => ({
  likeReview: jest.fn(),
  unlikeReview: jest.fn(),
}));
jest.mock("@/features/community/api/communityReview.service", () => ({
  getCommunityReviews: jest.fn(),
}));

const review = {
  id: 7,
  business: { id: 20 },
  is_liked: false,
  like_count: 3,
  is_liked_by_owner: false,
} as CommunityReview;
const otherReview = {
  ...review,
  id: 8,
  like_count: 2,
} as CommunityReview;
const businessReview: BusinessReview = {
  ...review,
  status: "published",
  has_reported: false,
  sentiment_label: null,
  sentiment_score: null,
  active_dispute_id: null,
};

function page<T>(items: T[], pageNumber: number) {
  return {
    items,
    pagination: {
      page: pageNumber,
      page_size: 1,
      total_items: 2,
      total_pages: 2,
      has_next: pageNumber === 1,
      has_previous: pageNumber > 1,
    },
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { gcTime: 0 },
    },
  });
  const newestKey = communityReviewsKey({
    ordering: "newest",
    clusterId: null,
    categoryIds: [],
    specialtyTagId: null,
    hasPhotos: false,
  });
  const helpfulKey = communityReviewsKey({
    ordering: "most_helpful",
    clusterId: 3,
    categoryIds: [5],
    specialtyTagId: 8,
    hasPhotos: true,
  });
  const communityPages: InfiniteData<CommunityReviewListResponse, number> = {
    pages: [page([otherReview], 1), page([review], 2)],
    pageParams: [1, 2],
  };
  const businessPages: InfiniteData<BusinessReviewListResponse, number> = {
    pages: [page([businessReview], 1)],
    pageParams: [1],
  };
  client.setQueryData(newestKey, communityPages);
  client.setQueryData(helpfulKey, communityPages);
  client.setQueryData(businessReviewsKey(20), businessPages);
  client.setQueryData<BusinessReviewPreview>(businessReviewPreviewKey(20), {
    reviews: [businessReview],
    total_count: 1,
    user_review: businessReview,
  });
  client.setQueryData([...businessReviewsKey(20), "merchant-all"], {
    reviews: [businessReview],
    totalCount: 1,
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, Wrapper, newestKey, helpfulKey };
}

function readCommunity(
  client: QueryClient,
  key: ReturnType<typeof communityReviewsKey>,
) {
  return client.getQueryData<InfiniteData<CommunityReviewListResponse, number>>(
    key,
  )!;
}

describe("useReviewLike Community coordination", () => {
  beforeEach(() => jest.clearAllMocks());

  it("patches all loaded caches without moving Most Helpful reviews or refetching its active feed", async () => {
    let finish!: (value: unknown) => void;
    (likeReview as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { client, Wrapper, newestKey, helpfulKey } = setup();
    const { result, unmount } = await renderHook(
      () => ({
        like: useReviewLike(20, 7),
        feed: useCommunityReviews({
          ordering: "most_helpful",
          clusterId: 3,
          categoryIds: [5],
          specialtyTagId: 8,
          hasPhotos: true,
        }),
      }),
      { wrapper: Wrapper },
    );

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.like.mutateAsync({
        reviewId: 7,
        isLiked: false,
      });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        readCommunity(client, helpfulKey).pages[1].items[0].like_count,
      ).toBe(4),
    );

    for (const key of [newestKey, helpfulKey]) {
      const data = readCommunity(client, key);
      expect(data.pages.map((entry) => entry.items[0].id)).toEqual([8, 7]);
      expect(data.pages[1].items[0].is_liked).toBe(true);
      expect(data.pageParams).toEqual([1, 2]);
      expect(data.pages[0].pagination.page).toBe(1);
    }
    expect(
      client.getQueryData<InfiniteData<BusinessReviewListResponse, number>>(
        businessReviewsKey(20),
      )?.pages[0].items[0].like_count,
    ).toBe(4);
    expect(
      client.getQueryData<BusinessReviewPreview>(businessReviewPreviewKey(20))
        ?.user_review?.is_liked,
    ).toBe(true);
    expect(
      client.getQueryData<{ reviews: BusinessReview[] }>([
        ...businessReviewsKey(20),
        "merchant-all",
      ])?.reviews[0].like_count,
    ).toBe(4);

    await act(async () => {
      finish({
        success: true,
        data: { id: 55, review_id: 7, is_liked: true },
      });
      await pending;
    });
    expect(getCommunityReviews).not.toHaveBeenCalled();
    expect(client.getQueryState(helpfulKey)?.isInvalidated).toBe(true);
    unmount();
    client.clear();
  });

  it("restores only the failed review's helpful fields", async () => {
    let fail!: (error: unknown) => void;
    (likeReview as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const { client, Wrapper, helpfulKey } = setup();
    const { result, unmount } = await renderHook(() => useReviewLike(20, 7), {
      wrapper: Wrapper,
    });

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.mutateAsync({ reviewId: 7, isLiked: false });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(readCommunity(client, helpfulKey).pages[1].items[0].is_liked).toBe(
        true,
      ),
    );
    client.setQueryData<InfiniteData<CommunityReviewListResponse, number>>(
      helpfulKey,
      (old) => ({
        ...old!,
        pages: old!.pages.map((entry, index) =>
          index === 0
            ? { ...entry, items: [{ ...otherReview, like_count: 9 }] }
            : entry,
        ),
      }),
    );

    await act(async () => {
      fail({ success: false, message: "Offline" });
      await expect(pending).rejects.toMatchObject({ message: "Offline" });
    });
    const restored = readCommunity(client, helpfulKey);
    expect(restored.pages[1].items[0]).toMatchObject({
      is_liked: false,
      like_count: 3,
    });
    expect(restored.pages[0].items[0].like_count).toBe(9);
    expect(
      client.getQueryData<BusinessReviewPreview>(businessReviewPreviewKey(20))
        ?.reviews[0].like_count,
    ).toBe(3);
    unmount();
    client.clear();
  });

  it("serializes overlapping likes and skips a duplicate request", async () => {
    let finish!: (value: unknown) => void;
    (likeReview as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { client, Wrapper, helpfulKey } = setup();
    const { result, unmount } = await renderHook(() => useReviewLike(20, 7), {
      wrapper: Wrapper,
    });

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current.mutateAsync({ reviewId: 7, isLiked: false });
      second = result.current.mutateAsync({ reviewId: 7, isLiked: false });
      await Promise.resolve();
    });
    await waitFor(() => expect(likeReview).toHaveBeenCalledTimes(1));
    await act(async () => {
      finish({
        success: true,
        data: { id: 55, review_id: 7, is_liked: true },
      });
      await Promise.all([first, second]);
    });
    expect(likeReview).toHaveBeenCalledTimes(1);
    expect(readCommunity(client, helpfulKey).pages[1].items[0].like_count).toBe(
      4,
    );
    unmount();
    client.clear();
  });

  it("unlikes once and keeps Community and business counts in sync", async () => {
    (likeReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 55, review_id: 7, is_liked: true },
    });
    (unlikeReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { review_id: 7, is_liked: false },
    });
    const { client, Wrapper, helpfulKey } = setup();
    const { result, unmount } = await renderHook(() => useReviewLike(20, 7), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 7, isLiked: false });
    });
    await act(async () => {
      await result.current.mutateAsync({ reviewId: 7, isLiked: true });
    });

    expect(unlikeReview).toHaveBeenCalledTimes(1);
    expect(readCommunity(client, helpfulKey).pages[1].items[0]).toMatchObject({
      is_liked: false,
      like_count: 3,
    });
    expect(
      client.getQueryData<BusinessReviewPreview>(businessReviewPreviewKey(20))
        ?.reviews[0],
    ).toMatchObject({ is_liked: false, like_count: 3 });
    unmount();
    client.clear();
  });

  it("reconciles the optimistic state with the server's is_liked response", async () => {
    (likeReview as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 55, review_id: 7, is_liked: false },
    });
    const { client, Wrapper, helpfulKey } = setup();
    const { result, unmount } = await renderHook(() => useReviewLike(20, 7), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 7, isLiked: false });
    });
    expect(readCommunity(client, helpfulKey).pages[1].items[0]).toMatchObject({
      is_liked: false,
      like_count: 3,
    });
    unmount();
    client.clear();
  });
});
