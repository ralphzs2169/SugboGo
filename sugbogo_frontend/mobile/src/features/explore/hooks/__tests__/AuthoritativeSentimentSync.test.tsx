import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react-native";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { myReviewsKey } from "@/features/profile/hooks/myReviewQueryKeys";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../../api/reviewBusiness.service";
import { businessReviewFixture } from "../../__tests__/review.fixtures";
import type { BusinessReview } from "../../types/review.types";
import { useReviewWorkflowStore } from "../../stores/reviewWorkflow.store";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "../reviewQueryKeys";
import {
  ReviewDerivedDataSyncProvider,
  useReviewDerivedDataSyncActions,
} from "../ReviewDerivedDataSyncProvider";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));

describe("authoritative sentiment synchronization", () => {
  let client: QueryClient;
  let review: BusinessReview | null;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-23T01:00:00Z"));
    jest.clearAllMocks();
    beginAuthSession();
    mockFocused = true;
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    review = businessReviewFixture({
      id: 18,
      is_own_review: true,
      author: { id: 10, first_name: "Ana", last_name: "Cruz", avatar_url: null },
      sentiment_label: "positive",
      sentiment_score: 0.8,
      sentiment_aggregate_included: false,
    });
    jest.mocked(getBusinessReviewPreview).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 1, user_review: review },
    }));
    jest.mocked(getExploreBusinessDetail).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: {
        id: 20,
        review_insights: {
          state: "insufficient_reviews",
          has_sufficient_sentiment_data: false,
          sentiment_computed_at: "2026-10-23T01:01:00Z",
        },
      } as never,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    await cleanup?.();
    cleanup = undefined;
    await client.cancelQueries();
    client.clear();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    jest.useRealTimers();
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <ReviewDerivedDataSyncProvider businessId={20}>
          {children}
        </ReviewDerivedDataSyncProvider>
      </QueryClientProvider>
    );
  }

  async function advance(milliseconds: number) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(milliseconds);
    });
  }

  async function mount() {
    const hook = await renderHook(() => useReviewDerivedDataSyncActions(), {
      wrapper: Wrapper,
    });
    cleanup = hook.unmount;
    await advance(1);
    return hook;
  }

  function historyInvalidations(spy: jest.SpyInstance) {
    return spy.mock.calls.filter(
      ([arg]) => JSON.stringify(arg.queryKey) === JSON.stringify(myReviewsKey(10)),
    ).length;
  }

  it("waits for repair despite stored classification and a newer aggregate timestamp", async () => {
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await mount();
    invalidate.mockClear();
    await advance(4_001);
    const pendingCalls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    expect(historyInvalidations(invalidate)).toBe(0);
    review = { ...review!, sentiment_aggregate_included: true };
    await advance(2_001);
    for (const queryKey of [
      exploreBusinessDetailKey(20),
      businessReviewsKey(20),
      myReviewsKey(10),
      COMMUNITY_REVIEWS_QUERY_KEY,
    ]) expect(invalidate).toHaveBeenCalledWith({ queryKey });
    expect(historyInvalidations(invalidate)).toBe(1);
    const completedCalls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    const completedDetailCalls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    expect(completedCalls).toBeGreaterThan(pendingCalls);
    await advance(6_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(completedCalls);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(completedDetailCalls);
    expect(historyInvalidations(invalidate)).toBe(1);
  });

  it("waits for a published review's classification and inclusion independently", async () => {
    review = { ...review!, sentiment_label: null, sentiment_score: null };
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await mount();
    invalidate.mockClear();
    await advance(2_001);
    review = { ...review!, sentiment_label: "positive", sentiment_score: 0.8 };
    await advance(2_001);
    // Persisted-score refreshes may happen, but observation must continue.
    const pending = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(2_001);
    expect(jest.mocked(getBusinessReviewPreview).mock.calls.length).toBeGreaterThan(pending);
    review = { ...review!, sentiment_aggregate_included: true };
    await advance(2_001);
    const complete = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(4_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(complete);
  });

  it.each([false, undefined])("bounds unverified inclusion %s without treating expiry as completion", async (included) => {
    review = { ...review!, sentiment_aggregate_included: included };
    await mount();
    await advance(46_001);
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(10_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
  });

  it.each(["foreground", "reconnect", "navigation"] as const)("recovers late inclusion after %s without a changed score", async (event) => {
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const hook = await mount();
    await advance(46_001);
    invalidate.mockClear();
    await act(async () => {
      if (event === "foreground") focusManager.setFocused(false);
      else if (event === "reconnect") onlineManager.setOnline(false);
      else {
        mockFocused = false;
        await hook.rerender({});
      }
    });
    review = { ...review!, sentiment_aggregate_included: true };
    await act(async () => {
      if (event === "foreground") focusManager.setFocused(true);
      else if (event === "reconnect") onlineManager.setOnline(true);
      else {
        mockFocused = true;
        await hook.rerender({});
      }
      await jest.advanceTimersByTimeAsync(1);
    });
    await advance(1);
    expect(historyInvalidations(invalidate)).toBe(1);
    await advance(4_001);
    expect(historyInvalidations(invalidate)).toBe(1);
  });

  it.each(["rejected", "deleted", "expired"])("stops fast polling when the review is %s", async (state) => {
    await mount();
    review = state === "deleted" ? null : {
      ...review!,
      ...(state === "expired" ? { created_at: "2026-09-01T00:00:00Z" } : { status: "rejected" as const }),
    };
    await advance(2_001);
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(6_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
  });

  it("does not acknowledge cached or in-flight pre-edit inclusion for a newer mutation", async () => {
    const hook = await mount();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await act(async () => {
      useReviewWorkflowStore.setState({ edits: { 18: 1 } });
      review = { ...review!, sentiment_aggregate_included: true };
      await client.refetchQueries({ queryKey: businessReviewPreviewKey(20) });
    });
    invalidate.mockClear();
    await act(async () => {
      hook.result.current.startSentimentSync({
        reviewId: 18,
        reviewText: "New accepted text.",
        minimumReviewUpdatedAt: "2026-10-23T01:00:00Z",
        baselineComputedAt: null,
        baselineGeneratedAt: null,
        baselineInsightsUpdatedAt: null,
        baselineInsightsState: null,
        observeGenerated: false,
        startedAt: Date.now(),
      });
      useReviewWorkflowStore.setState({ edits: {} });
    });
    await advance(2_001);
    expect(historyInvalidations(invalidate)).toBe(0);
    review = {
      ...review!,
      text: "New accepted text.",
      updated_at: "2026-10-23T01:00:00Z",
      sentiment_aggregate_included: true,
    };
    await advance(2_001);
    expect(historyInvalidations(invalidate)).toBe(1);
  });

  it.each(["account", "session"])("cannot acknowledge private inclusion after a %s change", async (event) => {
    await mount();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    invalidate.mockClear();
    await act(async () => {
      if (event === "account") useAuthStore.setState({ user: { id: 11 } as never });
      else beginAuthSession();
      client.setQueryData(businessReviewPreviewKey(20), {
        reviews: [], total_count: 1,
        user_review: { ...review!, sentiment_aggregate_included: true },
      });
    });
    await advance(4_001);
    expect(historyInvalidations(invalidate)).toBe(0);
  });
});
