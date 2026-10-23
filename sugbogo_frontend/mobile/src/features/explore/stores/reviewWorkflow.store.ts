import { create } from "zustand";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import type {
  LocalReviewPhoto,
  ReviewAuthor,
  ReviewCreateResult,
} from "../types/review.types";

export type ReviewSubmissionDraft = {
  token: number;
  userId: number;
  generation: number;
  businessId: number;
  businessName: string;
  text: string;
  showInCommunity: boolean;
  photos: LocalReviewPhoto[];
  author: ReviewAuthor;
  createdAt: string;
  state: "submitting" | "confirming" | "acknowledged" | "failed";
  result?: ReviewCreateResult;
  serverObserved?: boolean;
};

type WorkflowState = {
  submissions: ReviewSubmissionDraft[];
  edits: Record<number, number>;
};

/** Session-only drafts; authoritative review content stays in React Query. */
export const useReviewWorkflowStore = create<WorkflowState>(() => ({
  submissions: [],
  edits: {},
}));

let nextToken = 0;

export function nextReviewOperationToken() {
  nextToken += 1;
  return nextToken;
}

export function isCurrentReviewSession(
  userId: number | null,
  generation: number,
) {
  return (
    (useAuthStore.getState().user?.id ?? null) === userId &&
    getAuthSessionGeneration() === generation
  );
}

/** A transport/server error cannot establish whether a write committed. */
export function isUncertainReviewOutcome(error: unknown) {
  const code = (error as { code?: string })?.code;
  return (
    !code ||
    [
      "NETWORK_ERROR",
      "REQUEST_TIMEOUT",
      "UNKNOWN_ERROR",
      "SERVER_ERROR",
    ].includes(code)
  );
}

export function settleReviewSubmission(
  token: number,
  result?: ReviewCreateResult,
  uncertain = false,
) {
  useReviewWorkflowStore.setState((current) => ({
    submissions: current.submissions.flatMap((draft) => {
      if (draft.token !== token) return [draft];
      if (!isCurrentReviewSession(draft.userId, draft.generation)) return [];
      if (result) return [{ ...draft, state: "acknowledged" as const, result }];
      // A failed follow-up read must not undo a successful submission acknowledgement.
      if (draft.result) return [draft];
      if (uncertain) return [{ ...draft, state: "confirming" as const }];
      return [{ ...draft, state: "failed" as const }];
    }),
  }));
}

function clearReviewWorkflows() {
  useReviewWorkflowStore.setState({ submissions: [], edits: {} });
}

subscribeAuthSessionChanges(clearReviewWorkflows);
useAuthStore.subscribe((current, previous) => {
  if (
    current.user?.id !== previous.user?.id ||
    (previous.isAuthenticated && !current.isAuthenticated)
  )
    clearReviewWorkflows();
});
