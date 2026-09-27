import { DEFAULT_BUSINESS_REVIEW_FILTERS } from "../../types/review.types";
import {
  businessReviewsKey,
  filteredBusinessReviewsKey,
} from "../reviewQueryKeys";

describe("filteredBusinessReviewsKey", () => {
  it("reuses the unfiltered key for default criteria", () => {
    expect(filteredBusinessReviewsKey(20, DEFAULT_BUSINESS_REVIEW_FILTERS)).toEqual(
      businessReviewsKey(20),
    );
  });

  it("separates every server-side review criterion", () => {
    const base = DEFAULT_BUSINESS_REVIEW_FILTERS;
    const keys = [
      filteredBusinessReviewsKey(20, base),
      filteredBusinessReviewsKey(20, { ...base, sentiment: "positive" }),
      filteredBusinessReviewsKey(20, { ...base, topic: "Friendly service" }),
      filteredBusinessReviewsKey(20, { ...base, hasPhotos: true }),
      filteredBusinessReviewsKey(20, { ...base, merchantReplied: true }),
      filteredBusinessReviewsKey(20, { ...base, ordering: "oldest" }),
      filteredBusinessReviewsKey(20, { ...base, ordering: "most_liked" }),
      filteredBusinessReviewsKey(21, base),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(
      keys.length,
    );
    expect(keys[1].slice(0, 2)).toEqual(businessReviewsKey(20));
  });
});
