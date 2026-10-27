import { reviewModerationFeedback } from "../reviewModeration.utils";
import type { ReviewModerationState } from "../../types/review.types";

describe("author moderation feedback", () => {
  it.each<[ReviewModerationState, string]>([
    ["pending", "Checking"],
    ["processing", "Checking"],
    ["awaiting_retry", "Delayed"],
    ["awaiting_admin_review", "Under review"],
    ["retries_exhausted", "Needs review"],
    ["published", "Published"],
    ["rejected", "Not public"],
    ["under_review", "Under review"],
  ])("presents %s without internal details", (state, label) => {
    const status =
      state === "published" || state === "rejected" ? state : "under_review";
    expect(
      reviewModerationFeedback({ status, moderation_progress: { state } })
        .label,
    ).toBe(label);
  });

  it("keeps unknown held work private and does not imply a flag", () => {
    expect(reviewModerationFeedback({ status: "under_review" })).toEqual({
      label: "Under review",
      description:
        "Your review is saved privately. Its status is not yet confirmed.",
    });
    expect(reviewModerationFeedback({ status: "flagged" }).label).toBe(
      "Not public",
    );
  });

  it("prefers authoritative published/rejected status over stale progress", () => {
    expect(
      reviewModerationFeedback({
        status: "published",
        moderation_progress: { state: "pending" },
      }).label,
    ).toBe("Published");
    expect(
      reviewModerationFeedback({
        status: "rejected",
        moderation_progress: { state: "processing" },
      }).label,
    ).toBe("Not public");
  });
});
