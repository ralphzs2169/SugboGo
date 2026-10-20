import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
  type MerchantReviewSelection,
} from "../../types/merchantReviews.types";

const DEFAULT_SELECTION: MerchantReviewSelection = {
  filter: "all",
  ordering: "newest",
  contentFilters: DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
};

/** Validates and consumes tab entry intent before any feed request can use old filters. */
export default function useMerchantReviewSelection() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [state, setState] = useState({
    selection: DEFAULT_SELECTION,
    intentKey: null as string | null,
    reviewId: null as number | null,
    entry: 0,
  });
  const hasIntent =
    params.filter !== undefined ||
    params.ordering !== undefined ||
    params.reviewIntent !== undefined ||
    params.reviewId !== undefined;
  const key = hasIntent
    ? JSON.stringify([
        params.filter,
        params.ordering,
        params.reviewIntent,
        params.reviewId,
      ])
    : null;
  const validFilter =
    params.filter === "all" ||
    params.filter === "needs-reply" ||
    params.filter === "replied";
  const validOrdering =
    params.ordering === "newest" ||
    params.ordering === "oldest" ||
    params.ordering === "most_liked";
  const valid = hasIntent && validFilter && validOrdering;
  const pending = valid && state.intentKey !== key;
  const parsedReviewId =
    typeof params.reviewId === "string" && /^\d+$/.test(params.reviewId)
      ? Number(params.reviewId)
      : null;
  const requestedReviewId =
    parsedReviewId !== null &&
    Number.isSafeInteger(parsedReviewId) &&
    parsedReviewId > 0
      ? parsedReviewId
      : null;
  const reviewId = pending ? requestedReviewId : state.reviewId;
  const entry = pending ? state.entry + 1 : state.entry;
  const effective: MerchantReviewSelection = pending
    ? {
        ...DEFAULT_SELECTION,
        filter: requestedReviewId
          ? "all"
          : (params.filter as MerchantReviewSelection["filter"]),
        ordering: requestedReviewId
          ? "newest"
          : (params.ordering as MerchantReviewSelection["ordering"]),
      }
    : {
        ...state.selection,
        contentFilters:
          state.selection.contentFilters ??
          DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
      };

  // Adjust this hook's state before children can request a feed with stale filters.
  // Fast Refresh can preserve a selection created before content filters existed.
  if (state.intentKey !== key || !state.selection.contentFilters) {
    setState({ selection: effective, intentKey: key, reviewId, entry });
  }

  useEffect(() => {
    if (!hasIntent) return;
    router.setParams({
      filter: undefined,
      ordering: undefined,
      reviewIntent: undefined,
      ...(params.reviewId !== undefined ? { reviewId: undefined } : {}),
    });
  }, [hasIntent, key, params.reviewId, router]);

  return {
    ...effective,
    setSelection: (selection: MerchantReviewSelection) =>
      setState((current) => ({ ...current, selection, reviewId: null })),
    reviewId,
    entry,
    setContentFilters: (
      contentFilters: MerchantReviewSelection["contentFilters"],
    ) =>
      setState((current) => ({
        ...current,
        selection: { ...current.selection, contentFilters },
        reviewId: null,
      })),
    clearFilters: () =>
      setState((current) => ({
        ...current,
        selection: {
          ...current.selection,
          filter: "all",
          contentFilters: DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
        },
        reviewId: null,
      })),
    setFilter: (filter: MerchantReviewSelection["filter"]) =>
      setState((current) => ({
        ...current,
        selection: { ...current.selection, filter },
        reviewId: null,
      })),
    setOrdering: (ordering: MerchantReviewSelection["ordering"]) =>
      setState((current) => ({
        ...current,
        selection: { ...current.selection, ordering },
        reviewId: null,
      })),
  };
}
