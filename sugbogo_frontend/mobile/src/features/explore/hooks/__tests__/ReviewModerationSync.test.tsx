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

describe("asynchronous author review synchronization", () => {
  let client: QueryClient;
  let review = businessReviewFixture();
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
      author: {
        id: 10,
        first_name: "Ana",
        last_name: "Cruz",
        avatar_url: null,
      },
      status: "under_review",
      moderation_progress: { state: "pending" },
    });
    jest.mocked(getBusinessReviewPreview).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 0, user_review: review },
    }));
    jest.mocked(getExploreBusinessDetail).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { id: 20, review_insights: null } as never,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    useAuthStore.setState({ user: null, isAuthenticated: false });
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
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    return hook;
  }

  async function advance(milliseconds: number) {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 1_000) {
      await act(async () => {
        jest.advanceTimersByTime(Math.min(1_000, milliseconds - elapsed));
        await Promise.resolve();
      });
    }
  }

  it.each(["published", "rejected"] as const)(
    "refreshes all affected queries after a held-to-%s decision",
    async (status) => {
      const invalidate = jest.spyOn(client, "invalidateQueries");
      await mount();
      invalidate.mockClear();
      review = { ...review, status, moderation_progress: { state: status } };
      await advance(30_001);
      for (const queryKey of [
        businessReviewPreviewKey(20),
        businessReviewsKey(20),
        exploreBusinessDetailKey(20),
        myReviewsKey(10),
        COMMUNITY_REVIEWS_QUERY_KEY,
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey });
      }
      const decisionInvalidations = invalidate.mock.calls.filter(
        ([arg]) =>
          JSON.stringify(arg.queryKey) === JSON.stringify(myReviewsKey(10)),
      ).length;
      await advance(4_001);
      expect(
        invalidate.mock.calls.filter(
          ([arg]) =>
            JSON.stringify(arg.queryKey) === JSON.stringify(myReviewsKey(10)),
        ),
      ).toHaveLength(decisionInvalidations);
      if (status === "published")
        expect(
          jest.mocked(getBusinessReviewPreview).mock.calls.length,
        ).toBeGreaterThan(2);
    },
  );

  it("resumes a bounded aggregate refresh when sentiment arrives after the fast polling window", async () => {
    await mount();
    review = {
      ...review,
      status: "published",
      moderation_progress: { state: "published" },
    };
    await advance(30_001);
    await advance(46_000);
    const before = jest.mocked(getExploreBusinessDetail).mock.calls.length;
    review = {
      ...review,
      updated_at: new Date(Date.now()).toISOString(),
      sentiment_label: "positive",
      sentiment_score: 0.8,
    };
    await advance(31_000);
    await advance(4_001);
    expect(
      jest.mocked(getExploreBusinessDetail).mock.calls.length,
    ).toBeGreaterThan(before);
    expect(
      client.getQueryData<{ user_review: typeof review }>(
        businessReviewPreviewKey(20),
      )?.user_review.sentiment_score,
    ).toBe(0.8);
  });

  it.each(["route", "foreground", "reconnect"] as const)(
    "recovers after %s without polling while inactive",
    async (event) => {
      const hook = await mount();
      await act(async () => {
        if (event === "route") {
          mockFocused = false;
          await hook.rerender({});
        } else if (event === "foreground") focusManager.setFocused(false);
        else onlineManager.setOnline(false);
      });
      const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
      await advance(60_001);
      expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
      review = {
        ...review,
        status: "published",
        sentiment_label: "positive",
        sentiment_score: 0.8,
      };
      await act(async () => {
        if (event === "route") {
          mockFocused = true;
          await hook.rerender({});
        } else if (event === "foreground") focusManager.setFocused(true);
        else onlineManager.setOnline(true);
        await jest.advanceTimersByTimeAsync(1);
      });
      expect(
        client.getQueryData<{ user_review: typeof review }>(
          businessReviewPreviewKey(20),
        )?.user_review.status,
      ).toBe("published");
    },
  );

  it.each(["logout", "account", "session"] as const)(
    "stops checking on %s changes",
    async (event) => {
      await mount();
      await act(async () => {
        if (event === "logout")
          useAuthStore.setState({ user: null, isAuthenticated: false });
        else if (event === "account")
          useAuthStore.setState({ user: { id: 11 } as never });
        else beginAuthSession();
      });
      const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
      await advance(60_001);
      expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
    },
  );

  it("bounds moderation checks and recovers on a later foreground", async () => {
    await mount();
    await advance(721_000);
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(90_000);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(
      jest.mocked(getBusinessReviewPreview).mock.calls.length,
    ).toBeGreaterThan(calls);
  });

  it("shares one moderation polling owner across duplicate mounted providers", async () => {
    function Duplicated({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>
          <ReviewDerivedDataSyncProvider businessId={20}>
            <ReviewDerivedDataSyncProvider businessId={20}>
              {children}
            </ReviewDerivedDataSyncProvider>
          </ReviewDerivedDataSyncProvider>
        </QueryClientProvider>
      );
    }
    const hook = await renderHook(() => useReviewDerivedDataSyncActions(), {
      wrapper: Duplicated,
    });
    cleanup = hook.unmount;
    await advance(1);
    const before = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(60_001);
    expect(
      jest.mocked(getBusinessReviewPreview).mock.calls.length - before,
    ).toBe(2);
  });

  it("does not start sentiment polling for an ordinary photo-only update", async () => {
    review = {
      ...review,
      status: "published",
      sentiment_label: "positive",
      sentiment_score: 0.8,
    };
    await mount();
    review = {
      ...review,
      updated_at: new Date(Date.now() + 1_000).toISOString(),
      photos: [{ id: 9, photo_url: "https://example.com/photo.jpg" }],
    };
    await act(async () => {
      await client.refetchQueries({ queryKey: businessReviewPreviewKey(20) });
    });
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(5_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
  });

  it("discards a pending private response after the account changes", async () => {
    let resolve!: (
      response: Awaited<ReturnType<typeof getBusinessReviewPreview>>,
    ) => void;
    jest.mocked(getBusinessReviewPreview).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount();
    await act(async () => {
      useAuthStore.setState({ user: { id: 11 } as never });
      resolve({
        success: true,
        message: "Loaded",
        data: { reviews: [], total_count: 0, user_review: review },
      });
      await Promise.resolve();
    });
    expect(client.getQueryData(businessReviewPreviewKey(20))).toBeUndefined();
  });

  it("synchronizes fast publication even when no held snapshot was fetched", async () => {
    let acknowledged = false;
    jest.mocked(getBusinessReviewPreview).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: {
        reviews: [],
        total_count: 0,
        user_review: acknowledged ? review : null,
      },
    }));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const hook = await mount();
    review = {
      ...review,
      status: "published",
      sentiment_label: "positive",
      sentiment_score: 0.8,
    };
    await act(async () => {
      hook.result.current.observeReviewSubmission(review.id);
      acknowledged = true;
      await client.invalidateQueries({
        queryKey: businessReviewPreviewKey(20),
      });
    });
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(4_001);
    expect(
      jest.mocked(getBusinessReviewPreview).mock.calls.length,
    ).toBeGreaterThan(calls);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: myReviewsKey(10) });
  });
});
