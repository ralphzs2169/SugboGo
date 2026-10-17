import { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { myReviewsKey } from "@/features/profile/hooks/myReviewQueryKeys";
import type { BusinessReview } from "../../types/review.types";
import { businessReviewPreviewKey } from "../../hooks/reviewQueryKeys";
import { updateReviewInCaches } from "../reviewCache.utils";

const accepted = {
  id: 8,
  text: "Accepted content from the update response.",
  status: "published",
  photos: [{ id: 3, photo_url: "https://example.com/accepted.jpg" }],
  reply: null,
  updated_at: "2026-10-16T01:00:00Z",
  is_own_review: true,
  show_in_community: true,
} as BusinessReview;

describe("accepted review cache updates", () => {
  it.each([true, false])(
    "preserves business identity and server metadata with Community visibility %s",
    (showInCommunity) => {
      useAuthStore.setState({ user: { id: 10 } as never });
      const client = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
      });
      const before = {
        ...accepted,
        text: "Previously stored content.",
        business: { id: 20, business_name: "Sugbo Cafe" },
      };
      const history = {
        pages: [{ items: [before], pagination: { total_items: 12 } }],
        pageParams: [1],
      };
      const communityAuthor = { id: 10, role: "explorer", first_name: "Ana" };
      const community = {
        pages: [
          {
            items: [{ ...before, author: communityAuthor }],
            pagination: { total_items: 30 },
          },
        ],
        pageParams: [1],
      };
      client.setQueryData(myReviewsKey(10), history);
      client.setQueryData(COMMUNITY_REVIEWS_QUERY_KEY, community);
      updateReviewInCaches(client, 20, 10, {
        ...accepted,
        show_in_community: showInCommunity,
      });
      const updatedHistory = client.getQueryData<typeof history>(
        myReviewsKey(10),
      );
      expect(updatedHistory?.pages[0].items[0].text).toBe(accepted.text);
      expect(updatedHistory?.pages[0].items[0].business).toEqual(
        before.business,
      );
      expect(updatedHistory?.pages[0].pagination).toEqual(
        history.pages[0].pagination,
      );
      expect(updatedHistory?.pageParams).toEqual(history.pageParams);
      const updatedCommunity = client.getQueryData<typeof community>(
        COMMUNITY_REVIEWS_QUERY_KEY,
      );
      if (showInCommunity) {
        expect(updatedCommunity?.pages[0].items[0].text).toBe(accepted.text);
        expect(updatedCommunity?.pages[0].items[0].author).toEqual(
          communityAuthor,
        );
      } else expect(updatedCommunity?.pages[0].items).toEqual([]);
      expect(updatedCommunity?.pages[0].pagination).toEqual(
        community.pages[0].pagination,
      );
      client.clear();
    },
  );

  it("does not copy the prior author's own-review flags into the next account's business cache", () => {
    useAuthStore.setState({ user: { id: 99 } as never });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } },
    });
    const history = {
      pages: [
        {
          items: [{ ...accepted, text: "Original" }],
          pagination: { total_items: 1 },
        },
      ],
      pageParams: [1],
    };
    const preview = {
      reviews: [{ ...accepted, is_own_review: false }],
      user_review: null,
      total_count: 1,
    };
    client.setQueryData(myReviewsKey(10), history);
    client.setQueryData(myReviewsKey(99), history);
    client.setQueryData(businessReviewPreviewKey(20), preview);
    updateReviewInCaches(client, 20, 10, accepted);
    expect(
      client.getQueryData<typeof history>(myReviewsKey(10))?.pages[0].items[0]
        .text,
    ).toBe(accepted.text);
    expect(client.getQueryData(myReviewsKey(99))).toEqual(history);
    expect(client.getQueryData(businessReviewPreviewKey(20))).toEqual(preview);
    client.clear();
  });
});
