import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
} from "../../types/communityReview.types";
import {
  COMMUNITY_REVIEWS_QUERY_KEY,
  communityReviewsKey,
} from "../communityReviewQueryKeys";

function filters(changes: Partial<CommunityReviewFilters>) {
  return { ...DEFAULT_COMMUNITY_REVIEW_FILTERS, ...changes };
}

describe("communityReviewsKey", () => {
  it("uses the stable Community root and normalized default filters", () => {
    expect(COMMUNITY_REVIEWS_QUERY_KEY).toEqual(["community-reviews"]);
    expect(communityReviewsKey()).toEqual([
      "community-reviews",
      {
        ordering: "newest",
        clusterId: null,
        hasPhotos: false,
      },
    ]);
    expect(communityReviewsKey(filters({}))).toEqual(communityReviewsKey());
  });

  it("creates distinct cache entries for every server-side filter", () => {
    const keys = [
      communityReviewsKey(),
      communityReviewsKey(filters({ ordering: "most_helpful" })),
      communityReviewsKey(filters({ clusterId: 3 })),
      communityReviewsKey(filters({ clusterId: 4 })),
      communityReviewsKey(filters({ hasPhotos: true })),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(
      keys.length,
    );
    keys.forEach((key) => {
      expect(key.slice(0, 1)).toEqual(COMMUNITY_REVIEWS_QUERY_KEY);
      expect(JSON.stringify(key)).not.toContain('"page"');
    });
  });
});
