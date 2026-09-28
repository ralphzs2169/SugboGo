import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../../api/reviewBusiness.service";
import type { ExploreBusinessDetail } from "../../types/exploreBusiness.types";
import type { BusinessReviewPreview } from "../../types/review.types";
import {
  ReviewDerivedDataSyncProvider,
  useReviewDerivedDataSyncActions,
} from "../ReviewDerivedDataSyncProvider";

jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));

jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));

describe("ReviewDerivedDataSyncProvider lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stops unresolved sentiment polling at the bounded timeout", async () => {
    (getBusinessReviewPreview as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        reviews: [],
        total_count: 1,
        user_review: {
          id: 18,
          sentiment_label: null,
          sentiment_score: null,
        },
      } as BusinessReviewPreview,
    });
    (getExploreBusinessDetail as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 20,
        review_insights: null,
      } as ExploreBusinessDetail,
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    /** Mounts the synchronization owner with isolated query state. */
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider businessId={20}>
            {children}
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => useReviewDerivedDataSyncActions(),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.startSentimentSync({
        reviewId: 18,
        baselineComputedAt: null,
        baselineGeneratedAt: null,
        baselineInsightsUpdatedAt: null,
        baselineInsightsState: null,
        startedAt: Date.now(),
      });
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(getBusinessReviewPreview).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(45_000);
      await Promise.resolve();
    });
    const timedOutCallCount = (getBusinessReviewPreview as jest.Mock).mock.calls
      .length;

    await act(async () => {
      jest.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(timedOutCallCount);

    unmount();
    client.clear();
  });

  it("continues from sentiment completion through generated insights", async () => {
    jest.setSystemTime(new Date("2026-09-28T01:00:01Z"));
    const baselineGeneratedAt = "2026-09-28T01:00:00Z";
    const baselineUpdatedAt = "2026-09-28T01:00:00Z";

    (getBusinessReviewPreview as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        reviews: [],
        total_count: 1,
        user_review: {
          id: 18,
          sentiment_label: "positive",
          sentiment_score: 0.8,
        },
      } as BusinessReviewPreview,
    });
    (getExploreBusinessDetail as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 20,
          review_insights: {
            state: "ready",
            generated_at: baselineGeneratedAt,
            updated_at: baselineUpdatedAt,
            sentiment_computed_at: "2026-09-28T01:00:02Z",
          },
        } as ExploreBusinessDetail,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 20,
          review_insights: {
            state: "ready",
            generated_at: baselineGeneratedAt,
            updated_at: baselineUpdatedAt,
            sentiment_computed_at: "2026-09-28T01:00:02Z",
          },
        } as ExploreBusinessDetail,
      })
      .mockResolvedValue({
        success: true,
        data: {
          id: 20,
          review_insights: {
            state: "ready",
            generated_at: "2026-09-28T01:00:06Z",
            updated_at: "2026-09-28T01:00:06Z",
            sentiment_computed_at: "2026-09-28T01:00:02Z",
          },
        } as ExploreBusinessDetail,
      });

    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    /** Mounts the synchronization owner with isolated query state. */
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider businessId={20}>
            {children}
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => useReviewDerivedDataSyncActions(),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.startSentimentSync({
        reviewId: 18,
        baselineComputedAt: baselineUpdatedAt,
        baselineGeneratedAt,
        baselineInsightsUpdatedAt: baselineUpdatedAt,
        baselineInsightsState: "ready",
        startedAt: Date.now(),
      });
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    const previewCallsAfterSentiment = (
      getBusinessReviewPreview as jest.Mock
    ).mock.calls.length;
    const detailCallsAfterSentiment = (getExploreBusinessDetail as jest.Mock)
      .mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(2_001);
      await Promise.resolve();
    });

    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(
      previewCallsAfterSentiment,
    );
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(
      detailCallsAfterSentiment + 1,
    );

    await act(async () => {
      jest.advanceTimersByTime(2_001);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    const completedDetailCalls = (getExploreBusinessDetail as jest.Mock).mock
      .calls.length;

    await act(async () => {
      jest.advanceTimersByTime(2_001);
      await Promise.resolve();
    });

    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(
      completedDetailCalls,
    );

    unmount();
    client.clear();
  });

  it("keeps unchanged ready insights polling until the bounded timeout", async () => {
    const generatedAt = "2026-09-28T00:00:00Z";

    (getExploreBusinessDetail as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 20,
        review_insights: {
          state: "ready",
          generated_at: generatedAt,
        },
      } as ExploreBusinessDetail,
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    /** Mounts the synchronization owner with isolated query state. */
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider businessId={20}>
            {children}
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => useReviewDerivedDataSyncActions(),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.startGeneratedInsightsSync({
        baselineGeneratedAt: generatedAt,
        startedAt: Date.now(),
      });
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    const initialCallCount = (getExploreBusinessDetail as jest.Mock).mock.calls
      .length;

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    const callCountAfterGracePeriod = (
      getExploreBusinessDetail as jest.Mock
    ).mock.calls.length;

    expect(callCountAfterGracePeriod).toBeGreaterThan(initialCallCount);

    await act(async () => {
      jest.advanceTimersByTime(50_000);
      await Promise.resolve();
    });
    const timedOutCallCount = (getExploreBusinessDetail as jest.Mock).mock.calls
      .length;

    await act(async () => {
      jest.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(timedOutCallCount);

    unmount();
    client.clear();
  });
});
