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
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../../api/reviewBusiness.service";
import type {
  ExploreBusinessDetail,
  ReviewInsightRegeneration,
} from "../../types/exploreBusiness.types";
import {
  ReviewDerivedDataSyncProvider,
  useReviewDerivedDataSyncActions,
} from "../ReviewDerivedDataSyncProvider";
import {
  businessReviewPreviewKey,
  exploreBusinessDetailKey,
} from "../reviewQueryKeys";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));

describe("durable insight synchronization", () => {
  let client: QueryClient;
  let detail: ExploreBusinessDetail;
  let cleanup: (() => Promise<void>) | undefined;

  function progress(
    overrides: Partial<ReviewInsightRegeneration> = {},
  ): ReviewInsightRegeneration {
    return {
      status: "scheduled",
      is_outstanding: true,
      requested_revision: 2,
      completed_revision: 1,
      run_after: new Date(Date.now() + 120_000).toISOString(),
      content_available: false,
      content_is_current: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-23T01:00:00Z"));
    jest.clearAllMocks();
    mockFocused = true;
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    detail = {
      id: 20,
      review_insights: null,
      review_insight_regeneration: progress(),
    } as ExploreBusinessDetail;
    jest.mocked(getExploreBusinessDetail).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: detail,
    }));
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 0, user_review: null },
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(async () => {
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

  async function mount() {
    const hook = await renderHook(() => useReviewDerivedDataSyncActions(), {
      wrapper: Wrapper,
    });
    cleanup = hook.unmount;
    await advance(1);
    return hook;
  }

  async function advance(milliseconds: number) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(milliseconds);
    });
  }

  function complete(revision = 2) {
    detail = {
      ...detail,
      review_insight_regeneration: progress({
        status: "idle",
        is_outstanding: false,
        requested_revision: revision,
        completed_revision: revision,
      }),
    };
  }

  it("observes a null summary beyond 60 seconds and completes deterministically without Gemini content", async () => {
    await mount();
    await advance(125_000);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length,
    ).toBeGreaterThan(5);
    detail = {
      ...detail,
      review_insight_regeneration: progress({ status: "processing" }),
    };
    await advance(15_001);
    complete();
    await advance(5_001);
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(40_000);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.completed_revision,
    ).toBe(2);
  });

  it("keeps retry waits bounded and never interprets the polling budget as success", async () => {
    detail = {
      ...detail,
      review_insight_regeneration: progress({ status: "retry_wait" }),
    };
    await mount();
    await advance(721_000);
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    expect(calls).toBeLessThan(35);
    await advance(120_000);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.is_outstanding,
    ).toBe(true);
  });

  it("coalesces rapid mutation observations and waits for the newest requested revision", async () => {
    const hook = await mount();
    await act(async () => {
      hook.result.current.startGeneratedInsightsSync({
        baselineGeneratedAt: null,
        startedAt: Date.now(),
      });
      hook.result.current.startGeneratedInsightsSync({
        baselineGeneratedAt: null,
        baselineRequestedRevision: 3,
        startedAt: Date.now(),
      });
    });
    complete(2);
    await advance(15_001);
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    complete(3);
    await advance(15_001);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length,
    ).toBeGreaterThan(calls);
    const completedCalls = jest.mocked(getExploreBusinessDetail).mock.calls
      .length;
    await advance(30_000);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(completedCalls);
  });

  it("pauses while the route is hidden and refetches completion on return", async () => {
    const hook = await mount();
    mockFocused = false;
    await hook.rerender({});
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(120_000);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
    complete();
    mockFocused = true;
    await hook.rerender({});
    await advance(1);
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.is_outstanding,
    ).toBe(false);
  });

  it.each(["foreground", "reconnect"] as const)(
    "recovers completion on %s without polling in the background",
    async (event) => {
      await mount();
      await act(async () => {
        if (event === "foreground") focusManager.setFocused(false);
        else onlineManager.setOnline(false);
      });
      const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
      await advance(65_000);
      expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
      complete();
      await act(async () => {
        if (event === "foreground") focusManager.setFocused(true);
        else onlineManager.setOnline(true);
      });
      await advance(1);
      expect(
        client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
          ?.review_insight_regeneration?.completed_revision,
      ).toBe(2);
    },
  );

  it.each(["logout", "replace-session"] as const)(
    "stops when authority changes through %s",
    async (event) => {
      await mount();
      await act(async () => {
        if (event === "logout")
          useAuthStore.setState({ user: null, isAuthenticated: false });
        else beginAuthSession();
      });
      const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
      await advance(90_000);
      expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
    },
  );

  it("does not continue narrative polling after unmount and recovers on remount", async () => {
    const hook = await mount();
    await hook.unmount();
    cleanup = undefined;
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(130_000);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(calls);
    complete();
    await mount();
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.completed_revision,
    ).toBe(2);
  });

  it("starts narrative observation even when sentiment never completes", async () => {
    const hook = await mount();
    await act(async () => {
      hook.result.current.startSentimentSync({
        reviewId: 18,
        baselineComputedAt: null,
        baselineGeneratedAt: null,
        baselineInsightsUpdatedAt: null,
        baselineInsightsState: null,
        startedAt: Date.now(),
      });
    });
    await advance(46_000);
    const sentimentCalls = jest.mocked(getBusinessReviewPreview).mock.calls
      .length;
    const detailCalls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(31_000);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(sentimentCalls);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length,
    ).toBeGreaterThan(detailCalls);
  });

  it("keeps only one interval owner for overlapping providers", async () => {
    function Overlapping({ children }: PropsWithChildren) {
      return (
        <Wrapper>
          <ReviewDerivedDataSyncProvider businessId={20}>
            {children}
          </ReviewDerivedDataSyncProvider>
        </Wrapper>
      );
    }
    const hook = await renderHook(() => useReviewDerivedDataSyncActions(), {
      wrapper: Overlapping,
    });
    cleanup = hook.unmount;
    await advance(1);
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(30_001);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length - calls,
    ).toBe(2);
  });

  it("does not acknowledge a mutation from the cached pre-mutation idle response", async () => {
    complete(1);
    const hook = await mount();
    const updates = client.getQueryState(
      exploreBusinessDetailKey(20),
    )!.dataUpdateCount;
    detail = { ...detail, review_insight_regeneration: progress() };
    await act(async () => {
      hook.result.current.startGeneratedInsightsSync({
        baselineGeneratedAt: null,
        baselineRequestedRevision: 1,
        baselineDataUpdateCount: updates,
        startedAt: Date.now(),
      });
    });
    const calls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await advance(15_001);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length,
    ).toBeGreaterThan(calls);
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.is_outstanding,
    ).toBe(true);
  });

  it("finishes sentiment promptly while narrative work remains scheduled", async () => {
    detail = {
      ...detail,
      review_insights: {
        state: "pending",
        generated_at: null,
        sentiment_computed_at: new Date(Date.now() + 1_000).toISOString(),
      } as ExploreBusinessDetail["review_insights"],
    };
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: {
        reviews: [],
        total_count: 1,
        user_review: {
          id: 18,
          sentiment_label: "positive",
          sentiment_score: 0.9,
        } as never,
      },
    });
    const hook = await mount();
    await act(async () => {
      hook.result.current.startSentimentSync({
        reviewId: 18,
        baselineComputedAt: null,
        baselineGeneratedAt: null,
        baselineInsightsUpdatedAt: null,
        baselineInsightsState: null,
        startedAt: Date.now(),
      });
    });
    await act(async () => {
      await client.refetchQueries({ queryKey: businessReviewPreviewKey(20) });
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2_001);
    });
    const sentimentCalls = jest.mocked(getBusinessReviewPreview).mock.calls
      .length;
    await advance(30_000);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(sentimentCalls);
    expect(
      client.getQueryData<ExploreBusinessDetail>(exploreBusinessDetailKey(20))
        ?.review_insight_regeneration?.is_outstanding,
    ).toBe(true);
  });
});
