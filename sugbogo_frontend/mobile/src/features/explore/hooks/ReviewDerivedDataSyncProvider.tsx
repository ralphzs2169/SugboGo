import {
  focusManager,
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
} from "react";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { useAuthStore } from "@/features/auth/store/auth.store";

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../api/reviewBusiness.service";
import type { BusinessReview } from "../types/review.types";
import type { BusinessReviewInsights } from "../types/exploreBusiness.types";
import { invalidateBusinessCardCollections } from "../utils/reviewCache.utils";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "./reviewQueryKeys";

const POLL_INTERVAL_MS = 2_000;
const SENTIMENT_TIMEOUT_MS = 45_000;
const GENERATED_INSIGHTS_TIMEOUT_MS = 60_000;

export type SentimentSyncSession = {
  reviewId: number;
  baselineComputedAt: string | null;
  baselineGeneratedAt: string | null;
  baselineInsightsUpdatedAt: string | null;
  baselineInsightsState: BusinessReviewInsights["state"] | null;
  startedAt: number;
};

export type GeneratedInsightsSyncSession = {
  baselineGeneratedAt: string | null;
  baselineUpdatedAt?: string | null;
  baselineState?: BusinessReviewInsights["state"] | null;
  resultNotBefore?: number;
  requiresPostMutationUpdate?: boolean;
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

function ownsSession(userId: number) {
  const session = useAuthStore.getState();
  return session.isAuthenticated && session.user?.id === userId;
}

async function fetchSyncPreview(businessId: number, userId: number | null) {
  const response = await getBusinessReviewPreview(businessId);
  if (userId !== null && !ownsSession(userId))
    throw new Error("Review session changed.");
  return throwOnApiError(response);
}

async function fetchSyncDetail(businessId: number, userId: number | null) {
  const response = await getExploreBusinessDetail(businessId);
  if (userId !== null && !ownsSession(userId))
    throw new Error("Review session changed.");
  return throwOnApiError(response);
}

/** Finishes existing bounded work after navigation, without retaining screen state. */
async function continuePendingSynchronization(
  queryClient: QueryClient,
  businessId: number,
  userId: number,
  pending: PendingSynchronization,
) {
  const canContinue = () =>
    ownsSession(userId) &&
    Boolean(
      queryClient
        .getQueryCache()
        .find({ queryKey: exploreBusinessDetailKey(businessId), exact: true }),
    );
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
          queryFn: () => fetchSyncDetail(businessId, userId),
          staleTime: 0,
          retry: false,
        });
        if (!canContinue()) return;
        const sentiment = pending.sentiment;
        if (sentiment) {
          const preview = await queryClient.fetchQuery({
            queryKey: businessReviewPreviewKey(businessId),
            queryFn: () => fetchSyncPreview(businessId, userId),
            staleTime: 0,
            retry: false,
          });
          if (!canContinue()) return;
          if (
            pending.sentiment === sentiment &&
            isSentimentSynchronizationComplete(
              sentiment,
              preview.user_review,
              detail.review_insights,
            )
          ) {
            pending.sentiment = null;
            pending.generated = {
              baselineGeneratedAt: sentiment.baselineGeneratedAt,
              baselineUpdatedAt: sentiment.baselineInsightsUpdatedAt,
              baselineState: sentiment.baselineInsightsState,
              resultNotBefore: sentiment.startedAt,
              requiresPostMutationUpdate: true,
              startedAt: Date.now(),
            };
            pending.sawTransition = false;
            await Promise.all([
              invalidateBusinessCardCollections(queryClient),
              queryClient.invalidateQueries({
                queryKey: businessReviewsKey(businessId),
              }),
            ]);
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
  startSentimentSync: (session: StartSentimentSync) => void;
  startGeneratedInsightsSync: (session: StartGeneratedInsightsSync) => void;
};

const NOOP_ACTIONS: ReviewDerivedDataSyncActions = {
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
  insights: BusinessReviewInsights | null | undefined,
) {
  const computedAt = insights?.sentiment_computed_at;

  return Boolean(
    review?.id === session.reviewId &&
    review.sentiment_label !== null &&
    review.sentiment_score !== null &&
    computedAt &&
    Date.parse(computedAt) >= session.startedAt &&
    hasAdvancedTimestamp(
      computedAt,
      session.baselineComputedAt,
      session.startedAt,
    ),
  );
}

export function shouldStopGeneratedInsightsSync(
  session: GeneratedInsightsSyncSession,
  insights: BusinessReviewInsights | null | undefined,
  sawTransition: boolean,
) {
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
 * Coordinates short-lived review sentiment and generated-insight synchronization.
 *
 * Polling uses existing React Query resources and remains active only while this
 * provider is mounted. Pending work continues within the same deadlines after
 * navigation and stops when the account changes or the query cache is cleared.
 */
export function ReviewDerivedDataSyncProvider({
  businessId,
  children,
}: PropsWithChildren<{ businessId: number }>) {
  const queryClient = useQueryClient();
  const ownerId = useRef(useAuthStore.getState().user?.id ?? null).current;
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

  const continueAfterUnmount = useCallback(() => {
    if (continuing.current || ownerId === null || !ownsSession(ownerId)) return;
    continuing.current = true;
    void continuePendingSynchronization(
      queryClient,
      businessId,
      ownerId,
      pending.current,
    ).finally(() => {
      continuing.current = false;
    });
  }, [businessId, ownerId, queryClient]);

  useEffect(() => {
    const pendingWork = pending.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pendingWork.sentiment || pendingWork.generated)
        continueAfterUnmount();
    };
  }, [continueAfterUnmount]);

  const previewQuery = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: () => fetchSyncPreview(businessId, ownerId),
    enabled: Boolean(businessId && sentimentSession),
    refetchInterval: sentimentSession ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const detailQuery = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: () => fetchSyncDetail(businessId, ownerId),
    enabled: Boolean(businessId && (sentimentSession || generatedSession)),
    refetchInterval:
      sentimentSession || generatedSession ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const startSentimentSync = useCallback(
    (session: StartSentimentSync) => {
      pending.current.sentiment = session;
      if (mounted.current) setSentimentSession(session);
      else continueAfterUnmount();
    },
    [continueAfterUnmount],
  );

  const startGeneratedInsightsSync = useCallback(
    (session: StartGeneratedInsightsSync) => {
      pending.current.sawTransition = false;
      pending.current.generated = session;
      if (mounted.current) setGeneratedSession(session);
      else continueAfterUnmount();
    },
    [continueAfterUnmount],
  );

  useEffect(() => {
    if (!sentimentSession) {
      return;
    }

    const review = previewQuery.data?.user_review;
    if (
      !isSentimentSynchronizationComplete(
        sentimentSession,
        review,
        detailQuery.data?.review_insights,
      )
    ) {
      return;
    }

    // Query data is the external completion signal for this polling session.
    pending.current.sentiment = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentimentSession(null);
    startGeneratedInsightsSync({
      baselineGeneratedAt: sentimentSession.baselineGeneratedAt,
      baselineUpdatedAt: sentimentSession.baselineInsightsUpdatedAt,
      baselineState: sentimentSession.baselineInsightsState,
      resultNotBefore: sentimentSession.startedAt,
      requiresPostMutationUpdate: true,
      startedAt: Date.now(),
    });

    void Promise.all([
      invalidateBusinessCardCollections(queryClient),
      queryClient.invalidateQueries({
        queryKey: exploreBusinessDetailKey(businessId),
      }),
      queryClient.invalidateQueries({
        queryKey: businessReviewsKey(businessId),
      }),
    ]);
  }, [
    businessId,
    detailQuery.data,
    previewQuery.data,
    queryClient,
    sentimentSession,
    startGeneratedInsightsSync,
  ]);

  useEffect(() => {
    if (!sentimentSession) {
      return;
    }

    const timeout = setTimeout(() => {
      if (pending.current.sentiment?.startedAt === sentimentSession.startedAt)
        pending.current.sentiment = null;
      setSentimentSession((current) =>
        current?.startedAt === sentimentSession.startedAt ? null : current,
      );
    }, SENTIMENT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [sentimentSession]);

  useEffect(() => {
    if (!generatedSession) {
      return;
    }

    const insights = detailQuery.data?.review_insights;
    if (!insights) {
      return;
    }

    const isTransition =
      insights.state === "outdated" || insights.state === "pending";

    if (isTransition) {
      pending.current.sawTransition = true;
      return;
    }

    if (
      shouldStopGeneratedInsightsSync(
        generatedSession,
        insights,
        pending.current.sawTransition,
      )
    ) {
      // Query data is the external completion signal for this polling session.
      pending.current.generated = null;
      setGeneratedSession(null);
    }
  }, [detailQuery.data, generatedSession]);

  useEffect(() => {
    if (!generatedSession) {
      return;
    }

    const timeout = setTimeout(() => {
      if (pending.current.generated?.startedAt === generatedSession.startedAt)
        pending.current.generated = null;
      setGeneratedSession((current) =>
        current?.startedAt === generatedSession.startedAt ? null : current,
      );
    }, GENERATED_INSIGHTS_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [generatedSession]);

  const actions = useMemo(
    () => ({
      startSentimentSync,
      startGeneratedInsightsSync,
    }),
    [startGeneratedInsightsSync, startSentimentSync],
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
