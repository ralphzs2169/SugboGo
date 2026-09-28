import { useQuery, useQueryClient } from "@tanstack/react-query";
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

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../api/reviewBusiness.service";
import type { BusinessReview } from "../types/review.types";
import type { BusinessReviewInsights } from "../types/exploreBusiness.types";
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
      session.baselineState &&
        session.baselineState !== "insufficient_reviews",
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
 * provider is mounted and a successful mutation has registered pending work.
 */
export function ReviewDerivedDataSyncProvider({
  businessId,
  children,
}: PropsWithChildren<{ businessId: number }>) {
  const queryClient = useQueryClient();
  const [sentimentSession, setSentimentSession] =
    useState<SentimentSyncSession | null>(null);
  const [generatedSession, setGeneratedSession] =
    useState<GeneratedInsightsSyncSession | null>(null);
  const sawGeneratedTransition = useRef(false);

  const previewQuery = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: async () =>
      throwOnApiError(await getBusinessReviewPreview(businessId)),
    enabled: Boolean(businessId && sentimentSession),
    refetchInterval: sentimentSession ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const detailQuery = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: async () =>
      throwOnApiError(await getExploreBusinessDetail(businessId)),
    enabled: Boolean(businessId && (sentimentSession || generatedSession)),
    refetchInterval:
      sentimentSession || generatedSession ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const startSentimentSync = useCallback((session: StartSentimentSync) => {
    setSentimentSession(session);
  }, []);

  const startGeneratedInsightsSync = useCallback(
    (session: StartGeneratedInsightsSync) => {
      sawGeneratedTransition.current = false;
      setGeneratedSession(session);
    },
    [],
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
      sawGeneratedTransition.current = true;
      return;
    }

    if (
      shouldStopGeneratedInsightsSync(
        generatedSession,
        insights,
        sawGeneratedTransition.current,
      )
    ) {
      // Query data is the external completion signal for this polling session.
      setGeneratedSession(null);
    }
  }, [detailQuery.data, generatedSession]);

  useEffect(() => {
    if (!generatedSession) {
      return;
    }

    const timeout = setTimeout(() => {
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
