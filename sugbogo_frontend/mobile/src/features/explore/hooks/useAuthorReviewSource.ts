import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  BusinessReview,
  BusinessReviewPreview,
} from "../types/review.types";
import { businessReviewPreviewKey } from "./reviewQueryKeys";

/** Observes existing preview data without adding a fetch or polling observer. */
export function useCachedReviewPreview(businessId: number) {
  const client = useQueryClient();
  const subscribe = useCallback(
    (listener: () => void) => client.getQueryCache().subscribe(listener),
    [client],
  );
  const getSnapshot = useCallback(
    () =>
      client.getQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
      ),
    [client, businessId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Reuses the private preview cache when a paginated card has an older source. */
export function useAuthorReviewSource<
  T extends Pick<BusinessReview, "id" | "author" | "updated_at">,
>(businessId: number, review: T): T {
  const userId = useAuthStore((state) => state.user?.id);
  const data = useCachedReviewPreview(businessId);
  const source = data?.user_review;
  if (
    !source ||
    userId !== review.author?.id ||
    source?.author.id !== userId ||
    source.id !== review.id ||
    !Number.isFinite(Date.parse(source.updated_at)) ||
    Date.parse(source.updated_at) < Date.parse(review.updated_at)
  )
    return review;
  return { ...review, ...source };
}
