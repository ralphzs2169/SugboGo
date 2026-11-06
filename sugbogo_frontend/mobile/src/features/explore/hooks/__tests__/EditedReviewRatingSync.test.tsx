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
import {
  businessRatingFixture,
  businessReviewFixture,
} from "../../__tests__/review.fixtures";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import {
  getBusinessReviewPreview,
  updateReview,
} from "../../api/reviewBusiness.service";
import { ReviewDerivedDataSyncProvider } from "../ReviewDerivedDataSyncProvider";
import { useUpdateReview } from "../useBusinessReviews";
import {
  businessReviewPreviewKey,
  exploreBusinessDetailKey,
} from "../reviewQueryKeys";
import { guardBusinessRating } from "../businessRatingSync";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
  updateReview: jest.fn(),
}));

describe("edited review all-time rating completion", () => {
  let client: QueryClient;
  let review = businessReviewFixture();
  let rating = businessRatingFixture();
  let unmount: (() => Promise<void>) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-06T00:00:00Z"));
    jest.clearAllMocks();
    beginAuthSession();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    review = businessReviewFixture({
      id: 18,
      text: "The updated review text is authoritative.",
      is_own_review: true,
      author: { id: 10, first_name: "Ana", last_name: "Cruz", avatar_url: null },
      updated_at: new Date().toISOString(),
      rating_sentiment_complete: false,
    });
    rating = businessRatingFixture({
      scoring_version: "gemini-contract",
      provenance: "versioned",
      computed_at: "2026-11-05T23:00:00Z",
    });
    jest.mocked(getBusinessReviewPreview).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: { user_review: review, reviews: [review], total_count: 1 },
    }));
    jest.mocked(getExploreBusinessDetail).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: {
        id: 20,
        sentiment_rating: rating,
        review_insights: null,
        review_insight_regeneration: {
          requested_revision: 1,
          completed_revision: 1,
          status: "idle",
          is_outstanding: false,
        },
      } as never,
    }));
  });

  afterEach(async () => {
    await unmount?.();
    unmount = undefined;
    client.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    jest.useRealTimers();
  });

  async function advance(milliseconds: number) {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 1_000) {
      await act(async () => {
        jest.advanceTimersByTime(Math.min(1_000, milliseconds - elapsed));
        await Promise.resolve();
      });
    }
  }

  async function edit() {
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
    const hook = await renderHook(() => useUpdateReview(20), { wrapper: Wrapper });
    unmount = hook.unmount;
    await advance(1);
    jest.mocked(updateReview).mockResolvedValue({
      success: true,
      message: "Updated",
      data: review,
    });
    await act(async () => {
      await hook.result.current.mutateAsync({
        reviewId: review.id,
        text: review.text,
        photos: [],
        textChanged: true,
      });
    });
    await advance(1);
    expect(hook.result.current.isSuccess).toBe(true);
    return jest.spyOn(client, "invalidateQueries").mockClear();
  }

  async function deliverCompletion(completeReview = review) {
    review = completeReview;
    rating = {
      ...rating,
      value: 4.6,
      computed_at: new Date().toISOString(),
    };
    await act(async () => {
      client.setQueryData(businessReviewPreviewKey(20), {
        user_review: review,
        reviews: [review],
        total_count: 1,
      });
    });
    await advance(1);
  }

  it.each([
    ["recent", "2026-11-05T00:00:00Z"],
    ["older than thirty days", "2026-09-01T00:00:00Z"],
  ])("refreshes the rating for a %s edited review", async (_name, createdAt) => {
    review = { ...review, created_at: createdAt };
    const invalidate = await edit();
    await deliverCompletion({
      ...review,
      sentiment_label: "positive",
      sentiment_score: 1,
      rating_sentiment_complete: true,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
    expect(client.getQueryData(exploreBusinessDetailKey(20))).toMatchObject({
      sentiment_rating: { value: 4.6 },
    });
    expect(guardBusinessRating(client, 20, rating)?.value).toBe(4.6);
  });

  it("observes a delayed current-text completion after the short rating window", async () => {
    const invalidate = await edit();
    await advance(150_000);
    invalidate.mockClear();
    review = { ...review, rating_sentiment_complete: true };
    rating = { ...rating, value: 4.6, computed_at: new Date().toISOString() };
    await advance(31_000);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
  });

  it("retains passive completion observation after bounded polling expires", async () => {
    const invalidate = await edit();
    await advance(13 * 60_000);
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(60_000);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
    invalidate.mockClear();
    await deliverCompletion({ ...review, rating_sentiment_complete: true });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
  });

  it("does not accept completion for previous review text", async () => {
    const invalidate = await edit();
    await advance(150_000);
    invalidate.mockClear();
    await deliverCompletion({
      ...review,
      text: "Previous review text that was already scored.",
      rating_sentiment_complete: true,
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
  });

  it("refreshes an ineligible null-score completion and follows pending recalculation", async () => {
    const invalidate = await edit();
    await advance(150_000);
    invalidate.mockClear();
    review = { ...review, rating_sentiment_complete: true };
    rating = {
      ...rating,
      state: "pending",
      value: null,
      contributing_review_count: null,
    };
    await act(async () => {
      client.setQueryData(businessReviewPreviewKey(20), {
        user_review: review,
        reviews: [review],
        total_count: 1,
      });
    });
    await advance(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pockets"] });
    rating = businessRatingFixture({
      value: 3.2,
      contributing_review_count: 6,
      computed_at: new Date().toISOString(),
    });
    await advance(5_001);
    expect(client.getQueryData(exploreBusinessDetailKey(20))).toMatchObject({
      sentiment_rating: { value: 3.2, contributing_review_count: 6 },
    });
  });

  it("does not add all-time completion polling for legacy businesses", async () => {
    review = { ...review, rating_sentiment_complete: null };
    const invalidate = await edit();
    await advance(150_000);
    invalidate.mockClear();
    const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(31_000);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
    await deliverCompletion({
      ...review,
      sentiment_label: "positive",
      sentiment_score: 1,
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(20),
    });
  });
});
