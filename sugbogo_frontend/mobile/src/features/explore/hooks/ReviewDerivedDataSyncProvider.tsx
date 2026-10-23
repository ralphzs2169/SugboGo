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
import type { BusinessReview } from "../types/review.types";
import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../types/exploreBusiness.types";
import {
  isTrackedReviewInsightRegeneration,
  resolveReviewInsightRegeneration,
} from "../utils/reviewInsightRegeneration.utils";
import { invalidateBusinessCardCollections } from "../utils/reviewCache.utils";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "./reviewQueryKeys";

const POLL_INTERVAL_MS = 2_000;
const SENTIMENT_TIMEOUT_MS = 45_000;
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
          if (
            pending.sentiment === sentiment &&
            isSentimentSynchronizationComplete(
              sentiment,
              preview.user_review,
              detail.review_insights,
            )
          ) {
            pending.sentiment = null;
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
 * Polling uses existing React Query resources and remains active only while this
 * Narrative polling has a bounded foreground budget and stops on navigation.
 * Ordinary mount/focus/reconnect refetches recover work completed later.
 */
export function ReviewDerivedDataSyncProvider({
  businessId,
  children,
}: PropsWithChildren<{ businessId: number }>) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const currentOwnerId = useAuthStore((state) =>
    state.isAuthenticated ? (state.user?.id ?? null) : null,
  );
  const [ownerId] = useState(() => useAuthStore.getState().user?.id ?? null);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const [ownerGeneration] = useState(getAuthSessionGeneration);
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
    authorized && isFocused && Boolean(sentimentSession || generatedSession),
  );

  const previewQuery = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: () => fetchSyncPreview(businessId, ownerId, ownerGeneration),
    enabled: Boolean(businessId && authorized && isFocused && sentimentSession),
    refetchInterval: ownsPolling && sentimentSession ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const detailQuery = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: () => fetchSyncDetail(businessId, ownerId, ownerGeneration),
    enabled: Boolean(businessId && authorized && isFocused),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: (query) => {
      if (!ownsPolling) return false;
      if (sentimentSession) return POLL_INTERVAL_MS;
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
  const { refetch: refetchDetail } = detailQuery;

  const startSentimentSync = useCallback(
    (session: StartSentimentSync) => {
      if (!authorized || !ownsSession(ownerId!, ownerGeneration)) return;
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
      if (mounted.current) {
        exhausted.current = false;
        pending.current.generated = generated;
        setGeneratedSession(generated);
      }
      if (mounted.current) setSentimentSession(session);
      else continueAfterUnmount();
    },
    [authorized, continueAfterUnmount, ownerGeneration, ownerId],
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
    void refetchDetail();
  }, [authorized, isFocused, refetchDetail]);

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
