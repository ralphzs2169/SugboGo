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
  BusinessReview,
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
  state: "submitting" | "confirming" | "unconfirmed" | "acknowledged" | "failed";
  checkingStartedAt?: number;
  previousReviewIds?: number[];
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
export const SUBMISSION_CHECK_BUDGET_MS = 60_000;

/** Only a known server rejection establishes that creation did not succeed. */
export function isUncertainReviewSubmissionOutcome(error: unknown) {
  const code = (error as { code?: string })?.code;
  return ![
    "VALIDATION_ERROR",
    "PERMISSION_DENIED",
    "NOT_AUTHENTICATED",
    "AUTHENTICATION_FAILED",
    "SESSION_EXPIRED",
    "NOT_FOUND",
    "PARSE_ERROR",
    "UNSUPPORTED_MEDIA_TYPE",
    "RATE_LIMIT_EXCEEDED",
    "SUBMISSION_IN_PROGRESS",
  ].includes(code ?? "");
}

/** Check private identity and content before associating an uncertain request. */
export function matchesReviewSubmission(
  draft: ReviewSubmissionDraft,
  review: Pick<BusinessReview, "id" | "text" | "author" | "created_at" | "photos">,
  businessId: number,
) {
  if (
    draft.businessId !== businessId ||
    review.author?.id !== draft.userId ||
    !isCurrentReviewSession(draft.userId, draft.generation)
  )
    return false;
  if (draft.result) return draft.result.id === review.id;
  return (
    draft.state !== "failed" &&
    !draft.previousReviewIds?.includes(review.id) &&
    review.text?.trim() === draft.text.trim() &&
    review.photos?.length === draft.photos.length &&
    Date.parse(review.created_at) >= Date.parse(draft.createdAt) &&
    Date.parse(review.created_at) <= Date.now()
  );
}

/** Adopt a matching author record without creating public or engagement state. */
export function confirmReviewSubmission(
  review: Pick<
    BusinessReview,
    "id" | "text" | "author" | "created_at" | "photos" | "status" | "moderation_progress"
  >,
  businessId: number,
) {
  useReviewWorkflowStore.setState((current) => {
    let changed = false;
    const submissions = current.submissions.map((draft) => {
      if (!matchesReviewSubmission(draft, review, businessId)) return draft;
      const result = {
        id: review.id,
        business_id: businessId,
        user_id: draft.userId,
        status: review.status,
        moderation_progress: review.moderation_progress,
      };
      if (
        draft.state === "acknowledged" &&
        JSON.stringify(draft.result) === JSON.stringify(result)
      )
        return draft;
      changed = true;
      return { ...draft, state: "acknowledged" as const, result };
    });
    return changed ? { submissions } : current;
  });
}

/** Restart only read reconciliation; the original upload is never repeated. */
export function checkReviewSubmissionAgain(token: number) {
  useReviewWorkflowStore.setState((current) => ({
    submissions: current.submissions.map((draft) =>
      draft.token === token &&
      draft.state === "unconfirmed" &&
      isCurrentReviewSession(draft.userId, draft.generation)
        ? { ...draft, state: "confirming" as const, checkingStartedAt: Date.now() }
        : draft,
    ),
  }));
}

/** End the read budget without declaring that the original request failed. */
export function expireReviewSubmissionCheck(token: number) {
  useReviewWorkflowStore.setState((current) => ({
    submissions: current.submissions.map((draft) =>
      draft.token === token && draft.state === "confirming"
        ? { ...draft, state: "unconfirmed" as const }
        : draft,
    ),
  }));
}

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
      // A failed follow-up read must not undo a successful submission acknowledgement.
      if (draft.result) return [draft];
      if (result) return [{ ...draft, state: "acknowledged" as const, result }];
      if (uncertain) {
        return [{
          ...draft,
          state: "confirming" as const,
          checkingStartedAt: draft.checkingStartedAt ?? Date.now(),
        }];
      }
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
