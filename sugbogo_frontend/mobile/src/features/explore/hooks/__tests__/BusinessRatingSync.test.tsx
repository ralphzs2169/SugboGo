import type { PropsWithChildren } from "react";
import { useIsFocused } from "expo-router";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { deleteReview, updateReview } from "../../api/reviewBusiness.service";
import { businessReviewFixture } from "../../__tests__/review.fixtures";
import { ReviewDerivedDataSyncProvider } from "../ReviewDerivedDataSyncProvider";
import {
  beginBusinessRatingSync,
  guardBusinessRating,
} from "../businessRatingSync";
import type { BusinessSentimentRating } from "../../types/businessRating.types";
import { exploreBusinessDetailKey } from "../reviewQueryKeys";
import { useDeleteReview, useUpdateReview } from "../useBusinessReviews";
import {
  cancelBusinessCardCollections,
  invalidateBusinessCardCollections,
} from "../../utils/reviewCache.utils";
import { refreshAuthorReviewDecision } from "../../utils/reviewPublicationSync.utils";

jest.mock("expo-router", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
}));

const rating: BusinessSentimentRating = {
  state: "ready",
  value: 4.2,
  contributing_review_count: 5,
  experimental: true,
  provenance: "legacy_unverified",
  scoring_version: "legacy-unverified-v1",
  calculation_version: "signed-average-v1",
  computed_at: "2026-10-30T00:00:00Z",
  automatic_updates_enabled: true,
};

describe("rating synchronization through the existing detail query", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick"] });
    jest.clearAllMocks();
    jest.mocked(useIsFocused).mockReturnValue(true);
    onlineManager.setOnline(true);
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
  });
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    onlineManager.setOnline(true);
  });

  it("shares bounded polling across providers, preserves newer receipts, and stops on unmount", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let current: BusinessSentimentRating = {
      ...rating,
      state: "pending" as BusinessSentimentRating["state"],
      value: null,
      contributing_review_count: null,
    };
    jest.mocked(getExploreBusinessDetail).mockImplementation(
      async () =>
        ({
          success: true,
          data: { id: 20, review_insights: null, sentiment_rating: current },
        }) as never,
    );
    beginBusinessRatingSync(client, 20, rating);
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider
            businessId={20}
            observeAuthorReview={false}
          >
            <ReviewDerivedDataSyncProvider
              businessId={20}
              observeAuthorReview={false}
            >
              {children}
            </ReviewDerivedDataSyncProvider>
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }
    const hook = await renderHook(() => undefined, { wrapper: Wrapper });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    current = { ...rating, computed_at: "2026-10-30T00:00:10Z" };
    await act(async () => {
      jest.advanceTimersByTime(5_100);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
    expect(guardBusinessRating(client, 20, rating)?.state).toBe("pending");
    expect(guardBusinessRating(client, 20, current)?.value).toBe(4.2);
    for (let index = 0; index < 25; index += 1) {
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
    }
    const afterBudget = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(afterBudget);
    await act(async () => {
      client.setQueryData(exploreBusinessDetailKey(20), {
        id: 20,
        review_insights: null,
        sentiment_rating: {
          ...current,
          state: "pending",
          value: null,
          contributing_review_count: null,
        },
      });
    });
    current = { ...rating, computed_at: "2026-10-30T00:00:20Z" };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      jest.advanceTimersByTime(5_100);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(afterBudget + 1);
    expect(guardBusinessRating(client, 20, current)?.value).toBe(4.2);
    await hook.unmount();
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(afterBudget + 1);
    client.clear();
  });

  it.each([
    ["disabled exposure", undefined],
    ["manual-only snapshots", { ...rating, automatic_updates_enabled: false }],
    [
      "manual-only unavailable snapshots",
      { ...rating, state: "unavailable" as const, automatic_updates_enabled: false },
    ],
  ])("does not poll %s", async (_description, snapshot) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.mocked(getExploreBusinessDetail).mockResolvedValue({
      success: true,
      data: { id: 20, review_insights: null, sentiment_rating: snapshot },
    } as never);
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider
            businessId={20}
            observeAuthorReview={false}
          >
            {children}
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }
    const hook = await renderHook(() => undefined, { wrapper: Wrapper });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    await hook.unmount();
    client.clear();
  });

  it("observes recovery when the first rating response is unavailable and stops after completion", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let current: BusinessSentimentRating = {
      ...rating,
      state: "unavailable",
      value: null,
      contributing_review_count: null,
    };
    jest.mocked(getExploreBusinessDetail).mockImplementation(
      async () =>
        ({
          success: true,
          data: { id: 20, review_insights: null, sentiment_rating: current },
        }) as never,
    );
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider
            businessId={20}
            observeAuthorReview={false}
          >
            {children}
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }
    const hook = await renderHook(() => undefined, { wrapper: Wrapper });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    current = { ...rating, computed_at: "2026-10-30T00:00:10Z" };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_100);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
    expect(guardBusinessRating(client, 20, current)?.state).toBe("ready");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(130_000);
    });
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
    await hook.unmount();
    client.clear();
  });

  it.each(["timeout", "navigation", "account-change", "offline", "unmount"])(
    "stops unresolved rating recovery after %s",
    async (reason) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      jest.mocked(getExploreBusinessDetail).mockResolvedValue({
        success: true,
        data: {
          id: 20,
          review_insights: null,
          sentiment_rating: {
            ...rating,
            state: "unavailable",
            value: null,
            contributing_review_count: null,
          },
        },
      } as never);
      function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={client}>
            <ReviewDerivedDataSyncProvider
              businessId={20}
              observeAuthorReview={false}
            >
              {children}
            </ReviewDerivedDataSyncProvider>
          </QueryClientProvider>
        );
      }
      const hook = await renderHook(() => undefined, { wrapper: Wrapper });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_100);
      });
      expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
      if (reason === "timeout") {
        for (let index = 0; index < 24; index += 1) {
          await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000);
          });
        }
      } else if (reason === "navigation") {
        jest.mocked(useIsFocused).mockReturnValue(false);
        await hook.rerender(undefined);
      } else if (reason === "account-change") {
        await act(async () => {
          useAuthStore.setState({ user: { id: 99 } as never });
        });
      } else if (reason === "offline") {
        onlineManager.setOnline(false);
      } else {
        await hook.unmount();
      }
      const completedCalls = jest.mocked(getExploreBusinessDetail).mock.calls.length;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20_000);
      });
      expect(getExploreBusinessDetail).toHaveBeenCalledTimes(completedCalls);
      if (reason !== "unmount") await hook.unmount();
      client.clear();
    },
  );

  it("cancels pre-publication reads and invalidates detail, cards and private collections", async () => {
    const client = new QueryClient();
    client.setQueryData(exploreBusinessDetailKey(20), {
      id: 20,
      sentiment_rating: rating,
    });
    const cancel = jest.spyOn(client, "cancelQueries");
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await refreshAuthorReviewDecision(client, 20, 10, 4, "published");
    expect(cancel).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    expect(guardBusinessRating(client, 20, rating)?.value).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    await cancelBusinessCardCollections(client);
    await invalidateBusinessCardCollections(client);
    client.clear();
  });

  it.each([true, false])(
    "invalidates ratings only for successful text edits (textChanged=%s)",
    async (textChanged) => {
      const client = new QueryClient();
      client.setQueryData(exploreBusinessDetailKey(20), {
        id: 20,
        sentiment_rating: rating,
      });
      jest.mocked(updateReview).mockResolvedValue({
        success: true,
        message: "Updated",
        data: businessReviewFixture(),
      });
      const invalidate = jest.spyOn(client, "invalidateQueries");
      function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
      }
      const hook = await renderHook(() => useUpdateReview(20), {
        wrapper: Wrapper,
      });
      await act(async () => {
        await hook.result.current.mutateAsync({
          reviewId: 18,
          text: "Updated feedback",
          photos: [],
          textChanged,
        });
      });
      expect(guardBusinessRating(client, 20, rating)?.state).toBe(
        textChanged ? "pending" : "ready",
      );
      if (textChanged) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
      } else {
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["pockets"] });
      }
      await hook.unmount();
      client.clear();
    },
  );

  it("keeps the existing rating after a rejected edit", async () => {
    const client = new QueryClient();
    client.setQueryData(exploreBusinessDetailKey(20), {
      id: 20,
      sentiment_rating: rating,
    });
    jest.mocked(updateReview).mockRejectedValue(new Error("Edit rejected"));
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const hook = await renderHook(() => useUpdateReview(20), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({
          reviewId: 18,
          text: "Rejected feedback",
          photos: [],
          textChanged: true,
        }),
      ).rejects.toThrow("Edit rejected");
    });
    expect(guardBusinessRating(client, 20, rating)?.state).toBe("ready");
    await hook.unmount();
    client.clear();
  });

  it("suppresses the pre-deletion rating and refreshes its existing consumers", async () => {
    const client = new QueryClient();
    client.setQueryData(exploreBusinessDetailKey(20), {
      id: 20,
      sentiment_rating: rating,
    });
    jest.mocked(deleteReview).mockResolvedValue({
      success: true,
      message: "Deleted",
      data: { review_id: 18 },
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const hook = await renderHook(() => useDeleteReview(20), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await hook.result.current.mutateAsync({ reviewId: 18 });
    });
    expect(guardBusinessRating(client, 20, rating)?.state).toBe("pending");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    await hook.unmount();
    client.clear();
  });
});
