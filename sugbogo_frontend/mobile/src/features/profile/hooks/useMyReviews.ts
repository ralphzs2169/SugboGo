import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMyReviews } from "../api/myReviews.service";
import { myReviewsKey } from "./myReviewQueryKeys";

export { MY_REVIEWS_QUERY_KEY, myReviewsKey } from "./myReviewQueryKeys";

/** Loads private review pages without sharing history between accounts. */
export function useMyReviews() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isEnabled = isAuthenticated && userId !== null && !isAuthLoading;
  const query = useInfiniteQuery({
    queryKey: myReviewsKey(isEnabled ? userId : null),
    enabled: isEnabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      // Manual refetch also respects session restoration and sign-out.
      if (!isEnabled) {
        throw new Error("Sign in to view your reviews.");
      }
      return throwOnApiError(await getMyReviews(pageParam));
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

  return {
    ...query,
    reviews,
    userId,
    isEnabled,
    isAuthLoading,
    totalCount: isEnabled
      ? (query.data?.pages[0]?.pagination.total_items ?? 0)
      : 0,
  };
}
