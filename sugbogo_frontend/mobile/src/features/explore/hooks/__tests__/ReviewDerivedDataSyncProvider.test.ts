import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../types/exploreBusiness.types";
import { resolveReviewInsightRegeneration } from "../../utils/reviewInsightRegeneration.utils";
import type { BusinessReview } from "../../types/review.types";
import {
  isSentimentSynchronizationComplete,
  shouldStopGeneratedInsightsSync,
  type GeneratedInsightsSyncSession,
  type SentimentSyncSession,
} from "../ReviewDerivedDataSyncProvider";

function insights(
  state: BusinessReviewInsights["state"],
  generatedAt: string | null,
  sentimentComputedAt: string | null,
): BusinessReviewInsights {
  return {
    state,
    state_message: null,
    content_available: state === "ready",
    narrative: state === "ready" ? "A current summary." : null,
    review_count: 5,
    eligible_review_count: 5,
    minimum_eligible_review_count: 5,
    analyzed_review_count: 5,
    classified_review_count: 5,
    has_sufficient_sentiment_data: true,
    overall_vibe: "mostly_positive",
    is_sampled: false,
    sentiment: {
      positive: { count: 5, percentage: 100 },
      neutral: { count: 0, percentage: 0 },
      negative: { count: 0, percentage: 0 },
    },
    frequent_mentions: [],
    coverage_start: null,
    coverage_end: null,
    generated_at: generatedAt,
    sentiment_computed_at: sentimentComputedAt,
    updated_at: generatedAt,
  };
}

describe("review-derived data synchronization", () => {
  const scheduled: ReviewInsightRegeneration = {
    status: "scheduled",
    is_outstanding: true,
    requested_revision: 3,
    completed_revision: 2,
    run_after: null,
    content_available: true,
    content_is_current: false,
  };

  it("prefers top-level progress over a conflicting nested snapshot", () => {
    const nested = {
      ...scheduled,
      status: "idle" as const,
      is_outstanding: false,
    };
    expect(
      resolveReviewInsightRegeneration(scheduled, {
        ...insights("ready", null, null),
        regeneration: nested,
      }),
    ).toBe(scheduled);
    expect(
      resolveReviewInsightRegeneration(undefined, {
        ...insights("ready", null, null),
        regeneration: nested,
      }),
    ).toBe(nested);
  });

  it("uses completed revisions even without content or a changed generation timestamp", () => {
    const session: GeneratedInsightsSyncSession = {
      baselineGeneratedAt: "unchanged",
      baselineRequestedRevision: 2,
      targetRevision: 3,
      startedAt: 0,
    };
    expect(
      shouldStopGeneratedInsightsSync(session, null, false, scheduled),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(session, null, false, {
        ...scheduled,
        status: "idle",
        is_outstanding: false,
        requested_revision: 2,
        completed_revision: 2,
      }),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(session, null, false, {
        ...scheduled,
        status: "idle",
        is_outstanding: false,
        completed_revision: 3,
        content_available: false,
      }),
    ).toBe(true);
  });
  const sentimentSession: SentimentSyncSession = {
    reviewId: 18,
    baselineComputedAt: "2026-09-28T01:00:00Z",
    baselineGeneratedAt: "2026-09-28T01:00:00Z",
    baselineInsightsUpdatedAt: "2026-09-28T01:00:00Z",
    baselineInsightsState: "ready",
    startedAt: Date.parse("2026-09-28T01:00:01Z"),
  };

  it("waits for both review sentiment and a newer aggregate", () => {
    const pendingReview = {
      id: 18,
      sentiment_label: null,
      sentiment_score: null,
    } as BusinessReview;
    const completeReview = {
      id: 18,
      sentiment_label: "positive",
      sentiment_score: 0.9,
    } as BusinessReview;

    expect(
      isSentimentSynchronizationComplete(
        sentimentSession,
        pendingReview,
        insights("ready", null, "2026-09-28T01:00:04Z"),
      ),
    ).toBe(false);
    expect(
      isSentimentSynchronizationComplete(
        sentimentSession,
        completeReview,
        insights("ready", null, "2026-09-28T01:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isSentimentSynchronizationComplete(
        sentimentSession,
        completeReview,
        insights("ready", null, "2026-09-28T00:59:59Z"),
      ),
    ).toBe(false);
    expect(
      isSentimentSynchronizationComplete(
        sentimentSession,
        completeReview,
        insights("ready", null, "2026-09-28T01:00:04Z"),
      ),
    ).toBe(true);
  });

  it("continues through generated transitions and stops at terminal states", () => {
    const session: GeneratedInsightsSyncSession = {
      baselineGeneratedAt: "2026-09-28T01:00:00Z",
      startedAt: Date.parse("2026-09-28T01:00:01Z"),
    };

    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("pending", null, null),
        false,
      ),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("outdated", null, null),
        true,
      ),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("ready", "2026-09-28T01:00:06Z", null),
        true,
      ),
    ).toBe(true);
    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("insufficient_reviews", null, null),
        false,
      ),
    ).toBe(true);
  });

  it("keeps polling an unchanged ready response", () => {
    const session: GeneratedInsightsSyncSession = {
      baselineGeneratedAt: "2026-09-28T01:00:00Z",
      startedAt: Date.parse("2026-09-28T01:00:01Z"),
    };
    const unchanged = insights("ready", "2026-09-28T01:00:00Z", null);

    expect(shouldStopGeneratedInsightsSync(session, unchanged, false)).toBe(
      false,
    );
  });

  it("waits for a post-mutation insufficient result", () => {
    const session: GeneratedInsightsSyncSession = {
      baselineGeneratedAt: "2026-09-28T01:00:00Z",
      baselineUpdatedAt: "2026-09-28T01:00:00Z",
      baselineState: "insufficient_reviews",
      resultNotBefore: Date.parse("2026-09-28T01:00:01Z"),
      requiresPostMutationUpdate: true,
      startedAt: Date.parse("2026-09-28T01:00:05Z"),
    };

    expect(
      shouldStopGeneratedInsightsSync(
        session,
        {
          ...insights("insufficient_reviews", null, null),
          updated_at: "2026-09-28T01:00:00Z",
        },
        false,
      ),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(
        session,
        {
          ...insights("insufficient_reviews", null, null),
          updated_at: "2026-09-28T01:00:04Z",
        },
        false,
      ),
    ).toBe(true);
  });

  it("does not treat an old ready result as new when no baseline was cached", () => {
    const session: GeneratedInsightsSyncSession = {
      baselineGeneratedAt: null,
      startedAt: Date.parse("2026-09-28T01:00:01Z"),
    };

    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("ready", "2026-09-28T01:00:00Z", null),
        false,
      ),
    ).toBe(false);
    expect(
      shouldStopGeneratedInsightsSync(
        session,
        insights("ready", "2026-09-28T01:00:04Z", null),
        false,
      ),
    ).toBe(true);
  });
});
