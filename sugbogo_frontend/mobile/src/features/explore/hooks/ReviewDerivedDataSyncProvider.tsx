import {
  focusManager,
  onlineManager,
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useIsFocused } from "expo-router";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../api/reviewBusiness.service";
import type {
  BusinessReview,
  BusinessReviewPreview,
} from "../types/review.types";
import { isHeldReview } from "../utils/reviewModeration.utils";
import {
  refreshAuthorReviewDecision,
  refreshAuthorReviewReads,
  refreshAuthorReviewSentiment,
} from "../utils/reviewPublicationSync.utils";
import {
  confirmReviewSubmission,
  expireReviewSubmissionCheck,
  matchesReviewSubmission,
  SUBMISSION_CHECK_BUDGET_MS,
  useReviewWorkflowStore,
} from "../stores/reviewWorkflow.store";
import { useAuthorReviewSubmissions } from "./useAuthorReviewSubmissions";
import { exploreBusinessDetailStaleTime } from "./exploreBusinessDetailQueryPolicy";
import type {
  BusinessReviewInsights,
  ExploreBusinessDetail,
  ReviewInsightRegeneration,
} from "../types/exploreBusiness.types";
import {
  isTrackedReviewInsightRegeneration,
  resolveReviewInsightRegeneration,
} from "../utils/reviewInsightRegeneration.utils";
import {
  businessReviewPreviewKey,
  exploreBusinessDetailKey,
} from "./reviewQueryKeys";

import {
  beginBusinessRatingSync,
  observeBusinessRating,
  shouldPollBusinessRating,
  useBusinessRatingObservation,
} from "./businessRatingSync";
import { invalidateBusinessCardCollections } from "../utils/reviewCache.utils";

const POLL_INTERVAL_MS = 2_000;
const SENTIMENT_TIMEOUT_MS = 45_000;
const AUTHOR_CHECK_TIMEOUT_MS = 12 * 60_000;
const LEGACY_INSIGHTS_TIMEOUT_MS = 60_000;
const GENERATED_INSIGHTS_TIMEOUT_MS = 12 * 60_000;

// Only timer ownership is shared; regeneration state stays in React Query.
const pollingOwners = new WeakMap<
  QueryClient,
  Map<string, Map<symbol, () => void>>
>();

function usePollingOwner(
  client: QueryClient,
  businessId: number,
  ownerId: number | null,
  active: boolean,
) {
  const [token] = useState(() => Symbol("review-sync"));
  const key = `${businessId}:${ownerId}`;
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!active) return () => undefined;
      let businesses = pollingOwners.get(client);
      if (!businesses) {
        businesses = new Map();
        pollingOwners.set(client, businesses);
      }
      let owners = businesses.get(key);
      if (!owners) {
        owners = new Map();
        businesses.set(key, owners);
      }
      owners.set(token, notify);
      owners.forEach((listener) => listener());
      return () => {
        owners.delete(token);
        if (!owners.size) businesses.delete(key);
        owners.forEach((listener) => listener());
      };
    },
    [active, client, key, token],
  );
  const snapshot = useCallback(
    () => pollingOwners.get(client)?.get(key)?.keys().next().value === token,
    [client, key, token],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export type SentimentSyncSession = {
  reviewId: number;
  reviewText?: string;
  minimumReviewUpdatedAt?: string;
  baselinePreviewDataUpdateCount?: number;
  observeGenerated?: boolean;
  baselineComputedAt: string | null;
  baselineGeneratedAt: string | null;
  baselineInsightsUpdatedAt: string | null;
  baselineInsightsState: BusinessReviewInsights["state"] | null;
  baselineRequestedRevision?: number | null;
  baselineDataUpdateCount?: number;
  startedAt: number;
};

export type GeneratedInsightsSyncSession = {
  baselineGeneratedAt: string | null;
  baselineUpdatedAt?: string | null;
  baselineState?: BusinessReviewInsights["state"] | null;
  resultNotBefore?: number;
  requiresPostMutationUpdate?: boolean;
  baselineRequestedRevision?: number | null;
  baselineDataUpdateCount?: number;
  targetRevision?: number;
  startedAt: number;
};

type StartSentimentSync = Omit<SentimentSyncSession, "startedAt"> & {
  startedAt: number;
};

type StartGeneratedInsightsSync = GeneratedInsightsSyncSession;

type PendingSynchronization = {
  sentiment: SentimentSyncSession | null;
  generated: GeneratedInsightsSyncSession | null;
  sawTransition: boolean;
};

function ownsSession(userId: number, generation: number) {
  const session = useAuthStore.getState();
  return (
    session.isAuthenticated &&
    session.user?.id === userId &&
    getAuthSessionGeneration() === generation
  );
}

async function fetchSyncPreview(
  businessId: number,
  userId: number | null,
  generation: number,
) {
  if (userId !== null && !ownsSession(userId, generation))
    throw new Error("Review session changed.");
  const response = await getBusinessReviewPreview(businessId);
  if (userId !== null && !ownsSession(userId, generation))
    throw new Error("Review session changed.");
  return throwOnApiError(response);
}

async function fetchSyncDetail(
  businessId: number,
  userId: number | null,
  generation: number,
) {
  if (userId !== null && !ownsSession(userId, generation))
    throw new Error("Review session changed.");
  const response = await getExploreBusinessDetail(businessId);
  if (userId !== null && !ownsSession(userId, generation))
    throw new Error("Review session changed.");
  return throwOnApiError(response);
}

/** Finish the existing short sentiment grace period, without narrative polling. */
async function continuePendingSynchronization(
  queryClient: QueryClient,
  businessId: number,
  userId: number,
  generation: number,
  pending: PendingSynchronization,
) {
  const canContinue = () => {
    const detail = queryClient.getQueryState(
      exploreBusinessDetailKey(businessId),
    );
    return (
      ownsSession(userId, generation) &&
      onlineManager.isOnline() &&
      detail !== undefined &&
      !detail.error &&
      detail.fetchStatus !== "paused" &&
      !pollingOwners.get(queryClient)?.get(`${businessId}:${userId}`)?.size
    );
  };
  while (canContinue()) {
    if (
      pending.sentiment &&
      Date.now() - pending.sentiment.startedAt >= SENTIMENT_TIMEOUT_MS
    )
      pending.sentiment = null;
    if (
      pending.generated &&
      Date.now() - pending.generated.startedAt >= GENERATED_INSIGHTS_TIMEOUT_MS
    )
      pending.generated = null;
    if (!pending.sentiment && !pending.generated) return;

    if (focusManager.isFocused()) {
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: exploreBusinessDetailKey(businessId),
          queryFn: () => fetchSyncDetail(businessId, userId, generation),
          staleTime: 0,
          retry: false,
        });
        if (!canContinue()) return;
        const sentiment = pending.sentiment;
        if (sentiment) {
          const preview = await queryClient.fetchQuery({
            queryKey: businessReviewPreviewKey(businessId),
            queryFn: () => fetchSyncPreview(businessId, userId, generation),
            staleTime: 0,
            retry: false,
          });
          if (!canContinue()) return;
          const review = preview.user_review;
          if (!canObserveSentiment(review)) {
            pending.sentiment = null;
          }
          if (
            pending.sentiment === sentiment &&
            review?.author?.id === userId &&
            !useReviewWorkflowStore.getState().edits[review.id] &&
            isSentimentSynchronizationComplete(
              sentiment,
              preview.user_review,
              detail.review_insights,
            )
          ) {
            pending.sentiment = null;
            await refreshAuthorReviewSentiment(
              queryClient,
              businessId,
              userId,
              review,
            );
          }
        }
        if (pending.generated) {
          const insights = detail.review_insights;
          if (insights?.state === "pending" || insights?.state === "outdated")
            pending.sawTransition = true;
          else if (
            shouldStopGeneratedInsightsSync(
              pending.generated,
              insights,
              pending.sawTransition,
            )
          )
            pending.generated = null;
        }
      } catch {
        // Query errors remain retryable within the original bounded sync window.
      }
    }
    if (!canContinue() || (!pending.sentiment && !pending.generated)) return;
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

type ReviewDerivedDataSyncActions = {
  observeReviewSubmission: (reviewId: number) => void;
  startSentimentSync: (session: StartSentimentSync) => void;
  startGeneratedInsightsSync: (session: StartGeneratedInsightsSync) => void;
};

const NOOP_ACTIONS: ReviewDerivedDataSyncActions = {
  observeReviewSubmission: () => undefined,
  startSentimentSync: () => undefined,
  startGeneratedInsightsSync: () => undefined,
};

const ReviewDerivedDataSyncContext =
  createContext<ReviewDerivedDataSyncActions>(NOOP_ACTIONS);

function hasAdvancedTimestamp(
  current: string | null | undefined,
  baseline: string | null,
  startedAt: number,
) {
  if (!current) {
    return false;
  }

  if (baseline) {
    return current !== baseline;
  }

  return Date.parse(current) >= startedAt;
}

export function isSentimentSynchronizationComplete(
  session: SentimentSyncSession,
  review: BusinessReview | null | undefined,
  _insights?: BusinessReviewInsights | null,
) {
  return Boolean(
    review?.id === session.reviewId &&
    review.status === "published" &&
    review.sentiment_aggregate_included === true &&
    (session.reviewText === undefined || review.text === session.reviewText) &&
    (session.minimumReviewUpdatedAt === undefined ||
      Date.parse(review.updated_at) >= Date.parse(session.minimumReviewUpdatedAt)),
  );
}

/** Stop observing reviews outside the backend's published thirty-day population. */
function canObserveSentiment(review: BusinessReview | null | undefined) {
  if (!review || (review.status && review.status !== "published")) return false;
  const createdAt = Date.parse(review.created_at);
  return (
    !Number.isFinite(createdAt) ||
    Date.now() - createdAt <= 30 * 24 * 60 * 60_000
  );
}

export function shouldStopGeneratedInsightsSync(
  session: GeneratedInsightsSyncSession,
  insights: BusinessReviewInsights | null | undefined,
  sawTransition: boolean,
  progress:
    ReviewInsightRegeneration | null | undefined = insights?.regeneration,
) {
  if (isTrackedReviewInsightRegeneration(progress)) {
    const revision = Math.max(
      session.targetRevision ?? 0,
      session.baselineRequestedRevision ?? 0,
      progress.requested_revision,
    );
    return (
      !progress.is_outstanding &&
      progress.status === "idle" &&
      progress.completed_revision >= revision
    );
  }
  if (!insights) {
    return false;
  }

  if (insights.state === "insufficient_reviews") {
    if (!session.requiresPostMutationUpdate) {
      return true;
    }

    const baselineStateChanged = Boolean(
      session.baselineState && session.baselineState !== "insufficient_reviews",
    );
    const hasNewUpdate = hasAdvancedTimestamp(
      insights.updated_at,
      session.baselineUpdatedAt ?? null,
      session.resultNotBefore ?? session.startedAt,
    );

    return sawTransition || baselineStateChanged || hasNewUpdate;
  }

  if (insights.state !== "ready") {
    return false;
  }

  const hasNewGeneration = hasAdvancedTimestamp(
    insights.generated_at,
    session.baselineGeneratedAt,
    session.resultNotBefore ?? session.startedAt,
  );
  return hasNewGeneration || sawTransition;
}

/**
 * Observes independent sentiment and durable narrative work through existing queries.
 *
 * Narrative polling has a bounded foreground budget and stops on navigation.
 * Stale reads and outstanding work recover on mount/focus/reconnect.
 */
export function ReviewDerivedDataSyncProvider({
  businessId,
  observePublication = false,
  observeAuthorReview = true,
  children,
}: PropsWithChildren<{
  businessId: number;
  observePublication?: boolean;
  observeAuthorReview?: boolean;
}>) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const ratingObservation = useBusinessRatingObservation(businessId);
  const ratingPolling = shouldPollBusinessRating(ratingObservation);
  const currentOwnerId = useAuthStore((state) =>
    state.isAuthenticated ? (state.user?.id ?? null) : null,
  );
  const [ownerId] = useState(() => useAuthStore.getState().user?.id ?? null);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const [ownerGeneration] = useState(getAuthSessionGeneration);
  const edits = useReviewWorkflowStore((state) => state.edits);
  const submission = useAuthorReviewSubmissions(businessId)[0];
  const checkingSubmission = submission?.state === "confirming";
  const authorized =
    ownerId !== null &&
    currentOwnerId === ownerId &&
    ownerGeneration === generation;
  const exhausted = useRef(false);
  const mounted = useRef(true);
  const continuing = useRef(false);
  const pending = useRef<PendingSynchronization>({
    sentiment: null,
    generated: null,
    sawTransition: false,
  });
  const [sentimentSession, setSentimentSession] =
    useState<SentimentSyncSession | null>(null);
  const [generatedSession, setGeneratedSession] =
    useState<GeneratedInsightsSyncSession | null>(null);
  const authorCheckingStartedAt = useRef(0);
  const previousReview = useRef<BusinessReview | null>(
    queryClient.getQueryData<BusinessReviewPreview>(
      businessReviewPreviewKey(businessId),
    )?.user_review ?? null,
  );
  const scoredSource = useRef<string | null>(null);
  const refreshedScore = useRef<string | null>(null);
  const submittedReviewId = useRef<number | null>(null);
  const cachedReview = queryClient.getQueryData<BusinessReviewPreview>(
    businessReviewPreviewKey(businessId),
  )?.user_review;
  const needsAuthorCheck = (review: BusinessReview | null | undefined) =>
    Boolean(
      review &&
      (isHeldReview(review) ||
        (review.status === "published" &&
          (review.sentiment_score == null || review.sentiment_label == null))),
    );

  const continueAfterUnmount = useCallback(() => {
    const detail = queryClient.getQueryState(
      exploreBusinessDetailKey(businessId),
    );
    if (
      continuing.current ||
      ownerId === null ||
      !ownsSession(ownerId, ownerGeneration) ||
      !onlineManager.isOnline() ||
      detail?.error ||
      detail?.fetchStatus === "paused"
    )
      return;
    continuing.current = true;
    void Promise.resolve()
      .then(() =>
        continuePendingSynchronization(
          queryClient,
          businessId,
          ownerId,
          ownerGeneration,
          pending.current,
        ),
      )
      .finally(() => {
        continuing.current = false;
      });
  }, [businessId, ownerGeneration, ownerId, queryClient]);

  useEffect(() => {
    const pendingWork = pending.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingWork.generated = null;
      if (pendingWork.sentiment) continueAfterUnmount();
    };
  }, [continueAfterUnmount]);

  const ownsPolling = usePollingOwner(
    queryClient,
    businessId,
    ownerId,
    authorized &&
      isFocused &&
      Boolean(
        checkingSubmission ||
        ratingPolling ||
        sentimentSession ||
        generatedSession ||
        (observeAuthorReview && needsAuthorCheck(cachedReview)),
      ),
  );

  const previewQuery = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: () => fetchSyncPreview(businessId, ownerId, ownerGeneration),
    enabled: Boolean(
      businessId &&
      authorized &&
      isFocused &&
      (observeAuthorReview || sentimentSession || submission),
    ),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    ...(checkingSubmission ? { retry: false } : {}),
    refetchInterval: (query) => {
      if (!ownsPolling) return false;
      if (
        checkingSubmission &&
        Date.now() - (submission.checkingStartedAt ?? 0) < SUBMISSION_CHECK_BUDGET_MS
      )
        return 5_000;
      if (sentimentSession) return POLL_INTERVAL_MS;
      return observeAuthorReview &&
        needsAuthorCheck(query.state.data?.user_review) &&
        Date.now() - authorCheckingStartedAt.current < AUTHOR_CHECK_TIMEOUT_MS
        ? 30_000
        : false;
    },
    refetchIntervalInBackground: false,
  });
  const { refetch: refetchPreview } = previewQuery;

  useEffect(() => {
    if (
      !authorized ||
      !checkingSubmission ||
      !submission ||
      !ownsSession(ownerId!, ownerGeneration)
    )
      return;
    const remaining = Math.max(
      0,
      SUBMISSION_CHECK_BUDGET_MS - (Date.now() - (submission.checkingStartedAt ?? 0)),
    );
    const timeout = setTimeout(
      () => expireReviewSubmissionCheck(submission.token),
      remaining,
    );
    if (isFocused && remaining > 0)
      void refetchPreview({ cancelRefetch: false });
    return () => clearTimeout(timeout);
  }, [
    authorized,
    checkingSubmission,
    isFocused,
    ownerGeneration,
    ownerId,
    refetchPreview,
    submission,
  ]);

  useEffect(() => {
    const review = previewQuery.data?.user_review;
    if (
      !authorized ||
      !submission ||
      !review ||
      previewQuery.isError ||
      !previewQuery.isFetchedAfterMount ||
      !matchesReviewSubmission(submission, review, businessId)
    )
      return;
    if (!submission.result) submittedReviewId.current = review.id;
    confirmReviewSubmission(review, businessId);
  }, [
    authorized,
    businessId,
    previewQuery.data,
    previewQuery.isError,
    previewQuery.isFetchedAfterMount,
    submission,
  ]);

  const detailQuery = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: () => fetchSyncDetail(businessId, ownerId, ownerGeneration),
    enabled: Boolean(businessId && authorized && isFocused),
    staleTime: (query) => {
      if (
        sentimentSession ||
        generatedSession ||
        ratingPolling ||
        (ratingObservation && !ratingObservation.completedAt)
      ) {
        return 0;
      }

      return exploreBusinessDetailStaleTime(query.state.data);
    },
    refetchInterval: (query) => {
      if (!ownsPolling) return false;
      if (sentimentSession) return POLL_INTERVAL_MS;
      if (
        ratingPolling &&
        query.state.data?.sentiment_rating?.automatic_updates_enabled &&
        !query.state.error
      ) {
        return 5_000;
      }
      if (!generatedSession) return false;
      const progress = resolveReviewInsightRegeneration(
        query.state.data?.review_insight_regeneration,
        query.state.data?.review_insights,
      );
      if (!isTrackedReviewInsightRegeneration(progress))
        return POLL_INTERVAL_MS;
      if (progress.status === "processing") return 5_000;
      if (progress.status === "retry_wait") return 30_000;
      return 15_000;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (
      !authorized ||
      !isFocused ||
      detailQuery.isError ||
      !ownsSession(ownerId!, ownerGeneration)
    ) {
      return;
    }
    const rating = detailQuery.data?.sentiment_rating;
    if (
      rating?.state === "pending" &&
      rating.automatic_updates_enabled &&
      (!ratingObservation ||
        (ratingObservation.completedAt &&
          rating.computed_at &&
          Date.parse(rating.computed_at) >=
            Date.parse(ratingObservation.completedAt)))
    ) {
      beginBusinessRatingSync(queryClient, businessId, rating, false);
    } else if (observeBusinessRating(queryClient, businessId, rating)) {
      void invalidateBusinessCardCollections(queryClient);
    }
  }, [
    authorized,
    businessId,
    detailQuery.data,
    detailQuery.isError,
    isFocused,
    ownerGeneration,
    ownerId,
    queryClient,
    ratingObservation,
  ]);

  const startSentimentSync = useCallback(
    (session: StartSentimentSync) => {
      if (!authorized || !ownsSession(ownerId!, ownerGeneration)) return;
      session = {
        ...session,
        baselinePreviewDataUpdateCount:
          session.baselinePreviewDataUpdateCount ??
          (queryClient.getQueryState(businessReviewPreviewKey(businessId))
            ?.dataUpdateCount ?? 0),
      };
      pending.current.sentiment = session;
      // Narrative observation starts at mutation success, independently of scoring.
      const generated = {
        baselineGeneratedAt: session.baselineGeneratedAt,
        baselineUpdatedAt: session.baselineInsightsUpdatedAt,
        baselineState: session.baselineInsightsState,
        baselineRequestedRevision: session.baselineRequestedRevision,
        baselineDataUpdateCount: session.baselineDataUpdateCount,
        targetRevision: Math.max(
          pending.current.generated?.targetRevision ?? 0,
          session.baselineRequestedRevision ?? 0,
        ),
        resultNotBefore: session.startedAt,
        requiresPostMutationUpdate: true,
        startedAt: pending.current.generated?.startedAt ?? session.startedAt,
      };
      if (mounted.current && session.observeGenerated !== false) {
        exhausted.current = false;
        pending.current.generated = generated;
        setGeneratedSession(generated);
      }
      if (mounted.current) setSentimentSession(session);
      else continueAfterUnmount();
    },
    [
      authorized,
      businessId,
      continueAfterUnmount,
      ownerGeneration,
      ownerId,
      queryClient,
    ],
  );

  const observeReviewSubmission = useCallback(
    (reviewId: number) => {
      if (authorized && ownsSession(ownerId!, ownerGeneration)) {
        submittedReviewId.current = reviewId;
      }
    },
    [authorized, ownerGeneration, ownerId],
  );

  const startGeneratedInsightsSync = useCallback(
    (session: StartGeneratedInsightsSync) => {
      if (
        !mounted.current ||
        !authorized ||
        !ownsSession(ownerId!, ownerGeneration)
      )
        return;
      exhausted.current = false;
      const next = {
        ...session,
        startedAt: pending.current.generated?.startedAt ?? session.startedAt,
        targetRevision: Math.max(
          pending.current.generated?.targetRevision ?? 0,
          session.targetRevision ?? 0,
          session.baselineRequestedRevision ?? 0,
        ),
      };
      pending.current.sawTransition = false;
      pending.current.generated = next;
      setGeneratedSession(next);
    },
    [authorized, ownerGeneration, ownerId],
  );

  useEffect(() => {
    if (!authorized || !isFocused || !observeAuthorReview) return;
    const review = previewQuery.data?.user_review;
    if (
      !review ||
      !ownsSession(ownerId!, ownerGeneration) ||
      review.author?.id !== ownerId ||
      edits[review.id] ||
      !previewQuery.isFetchedAfterMount ||
      previewQuery.isError
    )
      return;
    const previous = previousReview.current;
    previousReview.current = review;
    const decided =
      ((previous?.id === review.id && isHeldReview(previous)) ||
        submittedReviewId.current === review.id) &&
      (review.status === "published" || review.status === "rejected");
    if (review.status === "published" || decided) {
      void refreshAuthorReviewDecision(
        queryClient,
        businessId,
        ownerId!,
        review.id,
        review.status as "published" | "rejected",
      );
    }
    if (decided) submittedReviewId.current = null;
    if (review.status !== "published") {
      scoredSource.current = null;
      if (review.status && pending.current.sentiment?.reviewId === review.id) {
        pending.current.sentiment = null;
        setSentimentSession(null);
      }
      return;
    }
    const current = pending.current.sentiment;
    if (
      current?.reviewId === review.id &&
      ((current.reviewText !== undefined && current.reviewText !== review.text) ||
        (current.minimumReviewUpdatedAt !== undefined &&
          Date.parse(review.updated_at) < Date.parse(current.minimumReviewUpdatedAt)))
    )
      return;
    if (!canObserveSentiment(review)) return;
    if (!current || review.sentiment_aggregate_included !== true) {
      void refreshAuthorReviewSentiment(queryClient, businessId, ownerId!, review);
    }
    const source = `${review.id}:${review.text}:${review.sentiment_label}:${review.sentiment_score}`;
    if (scoredSource.current === source && !decided) return;
    const incomplete = review.sentiment_aggregate_included !== true;
    scoredSource.current = source;
    if (!incomplete && !decided) return;
    const detail = queryClient.getQueryData<ExploreBusinessDetail>(
      exploreBusinessDetailKey(businessId),
    );
    startSentimentSync({
      reviewId: review.id,
      reviewText: review.text,
      minimumReviewUpdatedAt: review.updated_at,
      baselinePreviewDataUpdateCount:
        (queryClient.getQueryState(businessReviewPreviewKey(businessId))
          ?.dataUpdateCount ?? 0) - 1,
      observeGenerated: decided || observePublication,
      baselineComputedAt:
        detail?.review_insights?.sentiment_computed_at ?? null,
      baselineGeneratedAt: detail?.review_insights?.generated_at ?? null,
      baselineInsightsUpdatedAt: detail?.review_insights?.updated_at ?? null,
      baselineInsightsState: detail?.review_insights?.state ?? null,
      baselineRequestedRevision:
        detail?.review_insight_regeneration?.requested_revision ?? null,
      startedAt: Date.now(),
    });
  }, [
    authorized,
    businessId,
    edits,
    isFocused,
    observeAuthorReview,
    observePublication,
    ownerGeneration,
    ownerId,
    previewQuery.data,
    previewQuery.dataUpdatedAt,
    previewQuery.isFetchedAfterMount,
    previewQuery.isError,
    queryClient,
    startSentimentSync,
  ]);

  useEffect(() => {
    if (!authorized || !isFocused || !observeAuthorReview) return;
    const recover = () => {
      authorCheckingStartedAt.current = Date.now();
      if (ownsSession(ownerId!, ownerGeneration))
        void refetchPreview({ cancelRefetch: false });
    };
    recover();
    const unsubscribeFocus = focusManager.subscribe((focused) => {
      if (focused) recover();
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) recover();
    });
    return () => {
      unsubscribeFocus();
      unsubscribeOnline();
    };
  }, [
    authorized,
    isFocused,
    observeAuthorReview,
    ownerGeneration,
    ownerId,
    refetchPreview,
  ]);

  useEffect(() => {
    if (
      !authorized ||
      !isFocused ||
      !sentimentSession ||
      !ownsSession(ownerId!, ownerGeneration)
    )
      return;
    const review = previewQuery.data?.user_review;
    if (
      review?.id !== sentimentSession.reviewId ||
      review.author?.id !== ownerId ||
      edits[review.id] ||
      review.sentiment_aggregate_included === true ||
      (sentimentSession.reviewText !== undefined &&
        review.text !== sentimentSession.reviewText) ||
      (review.status && review.status !== "published") ||
      review.sentiment_label == null ||
      review.sentiment_score == null
    )
      return;
    const source = `${review.id}:${review.text}:${review.sentiment_label}:${review.sentiment_score}`;
    if (refreshedScore.current === source) return;
    refreshedScore.current = source;
    // Refresh public readers of the observed score without acknowledging aggregate inclusion.
    void refreshAuthorReviewReads(queryClient, businessId, ownerId!);
  }, [
    authorized,
    businessId,
    edits,
    isFocused,
    ownerGeneration,
    ownerId,
    previewQuery.data,
    queryClient,
    sentimentSession,
  ]);

  useEffect(() => {
    if (
      !authorized ||
      !isFocused ||
      !sentimentSession ||
      pending.current.sentiment !== sentimentSession ||
      !ownsSession(ownerId!, ownerGeneration) ||
      previewQuery.isError
    ) {
      return;
    }

    const review = previewQuery.data?.user_review;
    const updates = queryClient.getQueryState(businessReviewPreviewKey(businessId))
      ?.dataUpdateCount ?? 0;
    if (
      updates <= (sentimentSession.baselinePreviewDataUpdateCount ?? 0) ||
      (review && (review.author?.id !== ownerId || edits[review.id]))
    )
      return;
    const terminal = !canObserveSentiment(review);
    if (
      !terminal &&
      !isSentimentSynchronizationComplete(
        sentimentSession,
        review,
      )
    ) {
      return;
    }

    // Query data is the external completion signal for this polling session.
    pending.current.sentiment = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentimentSession(null);

    if (!terminal)
      void refreshAuthorReviewSentiment(queryClient, businessId, ownerId!, review!);
  }, [
    authorized,
    businessId,
    edits,
    isFocused,
    ownerGeneration,
    ownerId,
    previewQuery.data,
    previewQuery.dataUpdatedAt,
    previewQuery.isError,
    queryClient,
    sentimentSession,
  ]);

  useEffect(() => {
    if (!sentimentSession) {
      return;
    }

    const timeout = setTimeout(() => {
      if (authorized && ownsSession(ownerId!, ownerGeneration) && isFocused) {
        // This refresh ends a bounded observation window; it does not prove inclusion.
        void refreshAuthorReviewReads(queryClient, businessId, ownerId!);
      }
      if (pending.current.sentiment === sentimentSession)
        pending.current.sentiment = null;
      setSentimentSession((current) =>
        current === sentimentSession ? null : current,
      );
    }, Math.max(
      0,
      SENTIMENT_TIMEOUT_MS - (Date.now() - sentimentSession.startedAt),
    ));

    return () => clearTimeout(timeout);
  }, [
    authorized,
    businessId,
    isFocused,
    ownerGeneration,
    ownerId,
    queryClient,
    sentimentSession,
  ]);

  useEffect(() => {
    if (!generatedSession) {
      return;
    }

    const updates =
      queryClient.getQueryState(exploreBusinessDetailKey(businessId))
        ?.dataUpdateCount ?? 0;
    if (
      generatedSession.baselineDataUpdateCount !== undefined &&
      updates <= generatedSession.baselineDataUpdateCount
    )
      return;
    const insights = detailQuery.data?.review_insights;
    const progress = resolveReviewInsightRegeneration(
      detailQuery.data?.review_insight_regeneration,
      insights,
    );
    let targetRevision = pending.current.generated?.targetRevision ?? 0;
    if (isTrackedReviewInsightRegeneration(progress)) {
      targetRevision = Math.max(targetRevision, progress.requested_revision);
      if (pending.current.generated) {
        pending.current.generated = {
          ...pending.current.generated,
          targetRevision,
        };
      }
    }

    const isTransition =
      insights?.state === "outdated" || insights?.state === "pending";

    if (isTransition && !isTrackedReviewInsightRegeneration(progress)) {
      pending.current.sawTransition = true;
      return;
    }

    if (
      shouldStopGeneratedInsightsSync(
        { ...generatedSession, targetRevision },
        insights,
        pending.current.sawTransition,
        progress,
      )
    ) {
      // Query data is the external completion signal for this polling session.
      pending.current.generated = null;
      setGeneratedSession(null);
    }
  }, [
    businessId,
    detailQuery.data,
    detailQuery.dataUpdatedAt,
    generatedSession,
    queryClient,
  ]);

  useEffect(() => {
    if (!authorized || !isFocused) {
      pending.current.generated = null;
      // Route/account authority is the external cleanup signal for this session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeneratedSession(null);
      if (!authorized) {
        pending.current.sentiment = null;
        setSentimentSession(null);
      }
      exhausted.current = false;
      return;
    }
  }, [authorized, isFocused]);

  useEffect(() => {
    if (!authorized || !isFocused || generatedSession || exhausted.current)
      return;
    const progress = resolveReviewInsightRegeneration(
      detailQuery.data?.review_insight_regeneration,
      detailQuery.data?.review_insights,
    );
    if (
      !isTrackedReviewInsightRegeneration(progress) ||
      !progress.is_outstanding
    )
      return;
    startGeneratedInsightsSync({
      baselineGeneratedAt:
        detailQuery.data?.review_insights?.generated_at ?? null,
      targetRevision: progress.requested_revision,
      baselineRequestedRevision: progress.requested_revision,
      startedAt: Date.now(),
    });
  }, [
    authorized,
    detailQuery.data,
    generatedSession,
    isFocused,
    startGeneratedInsightsSync,
  ]);

  useEffect(() => {
    if (!generatedSession) {
      return;
    }

    const timeout = setTimeout(
      () => {
        exhausted.current = true;
        if (pending.current.generated?.startedAt === generatedSession.startedAt)
          pending.current.generated = null;
        setGeneratedSession((current) =>
          current?.startedAt === generatedSession.startedAt ? null : current,
        );
      },
      Math.max(
        0,
        (isTrackedReviewInsightRegeneration(
          resolveReviewInsightRegeneration(
            detailQuery.data?.review_insight_regeneration,
            detailQuery.data?.review_insights,
          ),
        )
          ? GENERATED_INSIGHTS_TIMEOUT_MS
          : LEGACY_INSIGHTS_TIMEOUT_MS) -
          (Date.now() - generatedSession.startedAt),
      ),
    );

    return () => clearTimeout(timeout);
  }, [detailQuery.data, generatedSession]);

  const actions = useMemo(
    () => ({
      observeReviewSubmission,
      startSentimentSync,
      startGeneratedInsightsSync,
    }),
    [observeReviewSubmission, startGeneratedInsightsSync, startSentimentSync],
  );

  return (
    <ReviewDerivedDataSyncContext.Provider value={actions}>
      {children}
    </ReviewDerivedDataSyncContext.Provider>
  );
}

/** Returns the synchronization triggers owned by the mounted review screen. */
export function useReviewDerivedDataSyncActions() {
  return useContext(ReviewDerivedDataSyncContext);
}
