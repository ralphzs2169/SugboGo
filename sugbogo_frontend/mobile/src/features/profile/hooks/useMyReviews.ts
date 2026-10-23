import {
  type InfiniteData,
  focusManager,
  onlineManager,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getBusinessReviewPreview } from "@/features/explore/api/reviewBusiness.service";
import { refreshAuthorReviewDecision } from "@/features/explore/utils/reviewPublicationSync.utils";
import { isHeldReview } from "@/features/explore/utils/reviewModeration.utils";
import { businessReviewPreviewKey } from "@/features/explore/hooks/reviewQueryKeys";
import { confirmReviewSubmission } from "@/features/explore/stores/reviewWorkflow.store";

import { getMyReviews } from "../api/myReviews.service";
import { myReviewsKey } from "./myReviewQueryKeys";
import type {
  MyReview,
  MyReviewFilter,
  MyReviewOrdering,
  MyReviewPage,
} from "../types/myReview.types";

export { MY_REVIEWS_QUERY_KEY, myReviewsKey } from "./myReviewQueryKeys";

/** Loads private review pages without sharing history between accounts. */
export function useMyReviews(
  status: MyReviewFilter = "all",
  ordering: MyReviewOrdering = "newest",
  focused = true,
) {
  const client = useQueryClient();
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const previous = useRef<{ scope: string; reviews: Map<number, MyReview> }>({
    scope: "",
    reviews: new Map(),
  });
  const checkingStartedAt = useRef(0);
  const [publicationSync, setPublicationSync] = useState<
    { scope: string; businessId: number }[]
  >([]);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isEnabled = isAuthenticated && userId !== null && !isAuthLoading;
  const queryKey =
    status === "all" && ordering === "newest"
      ? myReviewsKey(isEnabled ? userId : null)
      : [...myReviewsKey(isEnabled ? userId : null), status, ordering] as const;
  const query = useInfiniteQuery<
    MyReviewPage,
    Error,
    InfiniteData<MyReviewPage, number>,
    typeof queryKey,
    number
  >({
    queryKey,
    enabled: isEnabled && focused,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: false,
    refetchInterval: (current) =>
      focused &&
      isEnabled &&
      Date.now() - checkingStartedAt.current < 12 * 60_000 &&
      current.state.data?.pages.some((page) => page.items.some(isHeldReview))
        ? 30_000
        : false,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      // Manual refetch also respects session restoration and sign-out.
      const current = useAuthStore.getState();
      if (
        !isEnabled ||
        !current.isAuthenticated ||
        current.user?.id !== userId ||
        getAuthSessionGeneration() !== generation
      ) {
        throw new Error("Sign in to view your reviews.");
      }
      const response = await getMyReviews(pageParam, status, ordering);
      const auth = useAuthStore.getState();
      if (
        !auth.isAuthenticated ||
        auth.user?.id !== userId ||
        getAuthSessionGeneration() !== generation
      )
        throw new Error("Review session changed.");
      return throwOnApiError(response);
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });
  const reviews = useMemo(() => {
    if (!isEnabled) return [];
    const seen = new Set<number>();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (review) => {
        if (seen.has(review.id)) return false;
        seen.add(review.id);
        return true;
      },
    );
  }, [isEnabled, query.data]);
  const { refetch } = query;

  useEffect(() => {
    if (
      !isEnabled ||
      !focused ||
      userId === null ||
      !query.data ||
      query.isFetching
    )
      return;
    const scope = `${userId}:${generation}`;
    if (previous.current.scope !== scope)
      previous.current = { scope, reviews: new Map() };
    const isCurrent = () =>
      useAuthStore.getState().user?.id === userId &&
      useAuthStore.getState().isAuthenticated &&
      getAuthSessionGeneration() === generation;
    const decide = (
      review: Pick<MyReview, "id" | "status">,
      businessId: number,
    ) => {
      if (
        !isCurrent() ||
        (review.status !== "published" && review.status !== "rejected")
      )
        return;
      void refreshAuthorReviewDecision(
        client,
        businessId,
        userId,
        review.id,
        review.status,
      );
      if (review.status === "published") {
        setPublicationSync((current) =>
          current.some(
            (item) => item.scope === scope && item.businessId === businessId,
          )
            ? current
            : [...current, { scope, businessId }],
        );
      }
    };
    const currentIds = new Set(reviews.map((review) => review.id));
    for (const review of reviews) {
      if (review.business?.id) confirmReviewSubmission(review, review.business.id);
      const old = previous.current.reviews.get(review.id);
      previous.current.reviews.set(review.id, review);
      if (old && isHeldReview(old)) decide(review, review.business.id);
    }
    // A published review disappears from the held-only filter; reconcile just
    // that known identity through the existing private business preview.
    if (status === "under_review") {
      for (const old of previous.current.reviews.values()) {
        if (!isHeldReview(old) || currentIds.has(old.id)) continue;
        void client
          .fetchQuery({
            queryKey: businessReviewPreviewKey(old.business.id),
            queryFn: async () => {
              const response = await getBusinessReviewPreview(old.business.id);
              if (!isCurrent()) throw new Error("Review session changed.");
              return throwOnApiError(response);
            },
            staleTime: 0,
            retry: false,
          })
          .then((response) => {
            if (!isCurrent()) return;
            previous.current.reviews.delete(old.id);
            const review = response.user_review;
            if (review?.id === old.id) decide(review, old.business.id);
          })
          .catch(() => undefined);
      }
    }
  }, [
    client,
    focused,
    generation,
    isEnabled,
    query.data,
    query.isFetching,
    reviews,
    status,
    userId,
  ]);

  useEffect(() => {
    if (!focused || !isEnabled) return;
    const recover = () => {
      checkingStartedAt.current = Date.now();
      void refetch({ cancelRefetch: false });
    };
    recover();
    const unsubscribeFocus = focusManager.subscribe((active) => {
      if (active) recover();
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) recover();
    });
    return () => {
      unsubscribeFocus();
      unsubscribeOnline();
    };
  }, [focused, isEnabled, refetch]);

  return {
    ...query,
    reviews,
    publishedBusinessIds: isEnabled
      ? publicationSync
          .filter((item) => item.scope === `${userId}:${generation}`)
          .map((item) => item.businessId)
      : [],
    userId,
    isEnabled,
    isAuthLoading,
    summary: isEnabled ? query.data?.pages[0]?.summary : undefined,
    totalCount: isEnabled
      ? (query.data?.pages[0]?.pagination.total_items ?? 0)
      : 0,
  };
}
