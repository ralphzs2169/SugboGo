import { useMemo, useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { useReviewWorkflowStore } from "../stores/reviewWorkflow.store";

/** Shares private in-flight submissions across routes without public cache writes. */
export function useAuthorReviewSubmissions(businessId?: number) {
  const userId = useAuthStore((state) =>
    state.isAuthenticated ? state.user?.id : undefined,
  );
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const submissions = useReviewWorkflowStore((state) => state.submissions);
  return useMemo(
    () =>
      submissions.filter(
        (draft) =>
          draft.userId === userId &&
          draft.generation === generation &&
          (businessId === undefined || draft.businessId === businessId),
      ),
    [submissions, userId, generation, businessId],
  );
}
