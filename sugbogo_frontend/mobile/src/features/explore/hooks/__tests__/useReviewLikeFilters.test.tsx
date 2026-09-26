import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { likeReview } from "../../api/reviewBusiness.service";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReview,
  type BusinessReviewListResponse,
} from "../../types/review.types";
import type { InfiniteData } from "@tanstack/react-query";
import { useReviewLike } from "../useReviewLike";
import {
  businessReviewsKey,
  filteredBusinessReviewsKey,
} from "../reviewQueryKeys";

jest.mock("../../api/reviewBusiness.service", () => ({
  likeReview: jest.fn(),
  unlikeReview: jest.fn(),
}));

describe("useReviewLike with filtered reviews", () => {
  it("updates and invalidates every review-list variant after a like", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const review = {
      id: 3,
      is_liked: false,
      is_liked_by_owner: false,
      like_count: 1,
    } as BusinessReview;
    const baseKey = businessReviewsKey(20);
    const filteredKey = filteredBusinessReviewsKey(20, {
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      ordering: "most_liked",
    });
    const page: BusinessReviewListResponse = {
      items: [review],
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
    const infiniteData = { pages: [page], pageParams: [1] };
    const merchantKey = [...baseKey, "merchant-all"];
    client.setQueryData(baseKey, infiniteData);
    client.setQueryData(filteredKey, infiniteData);
    client.setQueryData(merchantKey, { reviews: [review], totalCount: 1 });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    (likeReview as jest.Mock).mockResolvedValue({ success: true, data: null });

    /** Supplies the review mutation with its React Query cache. */
    function Wrapper({ children }: PropsWithChildren) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = await renderHook(() => useReviewLike(20), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 3, isLiked: false });
    });

    expect(
      client.getQueryData<InfiniteData<BusinessReviewListResponse>>(baseKey)
        ?.pages[0].items[0].like_count,
    ).toBe(2);
    expect(
      client.getQueryData<InfiniteData<BusinessReviewListResponse>>(filteredKey)
        ?.pages[0].items[0].like_count,
    ).toBe(2);
    expect(
      client.getQueryData<{ reviews: BusinessReview[] }>(merchantKey)
        ?.reviews[0].like_count,
    ).toBe(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: baseKey });
    client.clear();
  });
});
