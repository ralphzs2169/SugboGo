import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { MerchantReviewSelection } from "../../types/merchantReviews.types";

const DEFAULT_SELECTION: MerchantReviewSelection = {
  filter: "all",
  ordering: "newest",
};

/** Validates and consumes tab entry intent before any feed request can use old filters. */
export default function useMerchantReviewSelection() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [state, setState] = useState({
    selection: DEFAULT_SELECTION,
    intentKey: null as string | null,
  });
  const hasIntent =
    params.filter !== undefined ||
    params.ordering !== undefined ||
    params.reviewIntent !== undefined;
  const key = hasIntent
    ? JSON.stringify([params.filter, params.ordering, params.reviewIntent])
    : null;
  const validFilter =
    params.filter === "all" ||
    params.filter === "needs-reply" ||
    params.filter === "replied";
  const validOrdering =
    params.ordering === "newest" || params.ordering === "oldest";
  const valid = hasIntent && validFilter && validOrdering;
  const pending = valid && state.intentKey !== key;
  const effective: MerchantReviewSelection = pending
    ? {
        filter: params.filter as MerchantReviewSelection["filter"],
        ordering: params.ordering as MerchantReviewSelection["ordering"],
      }
    : state.selection;

  // Adjust this hook's state before children can request a feed with stale filters.
  if (state.intentKey !== key) {
    setState({ selection: effective, intentKey: key });
  }

  useEffect(() => {
    if (!hasIntent) return;
    router.setParams({
      filter: undefined,
      ordering: undefined,
      reviewIntent: undefined,
    });
  }, [hasIntent, key, router]);

  return {
    ...effective,
    setFilter: (filter: MerchantReviewSelection["filter"]) =>
      setState((current) => ({
        ...current,
        selection: { ...current.selection, filter },
      })),
    setOrdering: (ordering: MerchantReviewSelection["ordering"]) =>
      setState((current) => ({
        ...current,
        selection: { ...current.selection, ordering },
      })),
  };
}
