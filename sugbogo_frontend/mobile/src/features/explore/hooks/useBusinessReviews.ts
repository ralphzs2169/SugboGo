import {
  keepPreviousData,
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { useAuthorReviewSubmissions } from "./useAuthorReviewSubmissions";
import {
  isCurrentReviewSession,
  isUncertainReviewOutcome,
  nextReviewOperationToken,
  settleReviewSubmission,
  useReviewWorkflowStore,
} from "../stores/reviewWorkflow.store";
import { myReviewsKey } from "@/features/profile/hooks/myReviewQueryKeys";
import { ACTIVITY_TIMELINE_QUERY_KEY } from "@/features/profile/hooks/activityTimelineQueryKeys";
import type { MyReviewPage } from "@/features/profile/types/myReview.types";

import * as reviewService from "../api/reviewBusiness.service";
import type {
  MyReviewReport,
  ReviewReportReason,
} from "../api/reviewBusiness.service";
import type {
  BusinessReviewFilters,
  BusinessReviewListResponse,
  BusinessReviewPreview,
  BusinessReview,
  LocalReviewPhoto,
  ReviewCreateResult,
} from "../types/review.types";
import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";
import { resolveReviewInsightRegeneration } from "../utils/reviewInsightRegeneration.utils";
import { useReviewDerivedDataSyncActions } from "./ReviewDerivedDataSyncProvider";
import {
  invalidateBusinessCardCollections,
  removeDeletedReviewFromPublicCaches,
  updateReviewInCaches,
} from "../utils/reviewCache.utils";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
  filteredBusinessReviewsKey,
} from "./reviewQueryKeys";

type ReviewMutationSync = "create" | "update" | "delete";

type ReviewMutationContext = {
  generation: number;
  operationToken: number;
  operationKey: string;
  authorUserId: number | null;
  baselineGeneratedAt: string | null;
  baselineInsightsUpdatedAt: string | null;
  baselineInsightsState:
    NonNullable<ExploreBusinessDetail["review_insights"]>["state"] | null;
  baselineSentimentComputedAt: string | null;
  baselineRequestedRevision: number | null;
  baselineDataUpdateCount: number;
  startedAt: number;
};

const latestOperations = new WeakMap<object, Map<string, number>>();

/**
 * Handles review-related mutations and refreshes the affected
 * review and business-detail queries after a successful mutation.
 */
function useReviewMutation<TVariables, TResult>(
  businessId: number,
  mutationFn: (variables: TVariables) => Promise<unknown>,
  sync?: ReviewMutationSync,
  refreshCommunity = false,
) {
  const queryClient = useQueryClient();
  const {
    observeReviewSubmission,
    startGeneratedInsightsSync,
    startSentimentSync,
  } = useReviewDerivedDataSyncActions();

  return useMutation<TResult, Error, TVariables, ReviewMutationContext>({
    mutationFn: async (variables: TVariables) =>
      throwOnApiError((await mutationFn(variables)) as never) as TResult,

    onMutate: (variables) => {
      const user = useAuthStore.getState().user;
      const authorUserId = user?.id ?? null;
      const generation = getAuthSessionGeneration();
      const operationToken = nextReviewOperationToken();
      const operationKey = `${generation}:${authorUserId}:${businessId}:${sync}`;
      let operations = latestOperations.get(queryClient);
      if (!operations) {
        operations = new Map();
        latestOperations.set(queryClient, operations);
      }

      if (sync === "create" && user) {
        const existing = useReviewWorkflowStore
          .getState()
          .submissions.some(
            (draft) =>
              draft.businessId === businessId &&
              draft.userId === user.id &&
              draft.generation === generation &&
              draft.state !== "failed",
          );
        if (existing) {
          throw {
            code: "SUBMISSION_IN_PROGRESS",
            message: "Check your submitted review before trying again.",
          };
        }
        const input = variables as {
          text: string;
          photos: LocalReviewPhoto[];
          businessName?: string;
          showInCommunity?: boolean;
        };
        useReviewWorkflowStore.setState((current) => ({
          submissions: [
            ...current.submissions.filter(
              (draft) =>
                draft.businessId !== businessId || draft.userId !== user.id,
            ),
            {
              token: operationToken,
              userId: user.id,
              generation,
              businessId,
              businessName: input.businessName ?? "Your review",
              text: input.text,
              showInCommunity: input.showInCommunity ?? true,
              photos: input.photos.map((photo) => ({ ...photo })),
              author: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                avatar_url: user.avatar_url ?? null,
                avatar_key: user.avatar_key,
              },
              createdAt: new Date().toISOString(),
              state: "submitting",
            },
          ],
        }));
      }
      operations.set(operationKey, operationToken);
      if (sync === "update") {
        const reviewId = (variables as { reviewId: number }).reviewId;
        useReviewWorkflowStore.setState((current) => ({
          edits: { ...current.edits, [reviewId]: operationToken },
        }));
      }
      const detail = queryClient.getQueryData<ExploreBusinessDetail>(
        exploreBusinessDetailKey(businessId),
      );

      return {
        authorUserId,
        generation,
        operationToken,
        operationKey,
        baselineGeneratedAt: detail?.review_insights?.generated_at ?? null,
        baselineInsightsUpdatedAt: detail?.review_insights?.updated_at ?? null,
        baselineInsightsState: detail?.review_insights?.state ?? null,
        baselineSentimentComputedAt:
          detail?.review_insights?.sentiment_computed_at ?? null,
        baselineRequestedRevision:
          resolveReviewInsightRegeneration(
            detail?.review_insight_regeneration,
            detail?.review_insights,
          )?.requested_revision ?? null,
        baselineDataUpdateCount:
          queryClient.getQueryState(exploreBusinessDetailKey(businessId))
            ?.dataUpdateCount ?? 0,
        startedAt: Date.now(),
      };
    },

    onSuccess: async (result, variables, context) => {
      const isCurrent = () =>
        isCurrentReviewSession(context.authorUserId, context.generation) &&
        latestOperations.get(queryClient)?.get(context.operationKey) ===
          context.operationToken;
      if (!isCurrent()) return;
      if (sync === "create") {
        settleReviewSubmission(
          context.operationToken,
          result as ReviewCreateResult,
        );
      }
      if (
        sync === "create" &&
        (result as ReviewCreateResult).status !== "published"
      ) {
        observeReviewSubmission?.((result as ReviewCreateResult).id);
      }
      if (sync === "update") {
        await Promise.all([
          ...(context.authorUserId !== null
            ? [
                queryClient.cancelQueries({
                  queryKey: myReviewsKey(context.authorUserId),
                }),
              ]
            : []),
          queryClient.cancelQueries({
            queryKey: businessReviewPreviewKey(businessId),
          }),
          queryClient.cancelQueries({
            queryKey: businessReviewsKey(businessId),
          }),
          queryClient.cancelQueries({ queryKey: COMMUNITY_REVIEWS_QUERY_KEY }),
        ]);
        if (!isCurrent()) return;
        updateReviewInCaches(
          queryClient,
          businessId,
          context.authorUserId,
          result as BusinessReview,
        );
      }
      if (sync === "delete") {
        // Discard pre-deletion responses before removing cached public content.
        await Promise.all([
          queryClient.cancelQueries({
            queryKey: businessReviewPreviewKey(businessId),
          }),
          queryClient.cancelQueries({
            queryKey: businessReviewsKey(businessId),
          }),
          queryClient.cancelQueries({ queryKey: COMMUNITY_REVIEWS_QUERY_KEY }),
        ]);
        if (!isCurrent()) return;
        useReviewWorkflowStore.setState((current) => ({
          submissions: current.submissions.filter(
            (draft) =>
              draft.businessId !== businessId ||
              draft.userId !== context.authorUserId,
          ),
        }));
        removeDeletedReviewFromPublicCaches(
          queryClient,
          businessId,
          (result as { review_id: number }).review_id,
        );
      }
      if (sync === "delete" && context.authorUserId !== null) {
        const historyKey = myReviewsKey(context.authorUserId);
        // A pre-deletion request must not restore the confirmed-deleted item.
        await queryClient.cancelQueries({ queryKey: historyKey });
        if (!isCurrent()) return;
        queryClient.setQueryData<InfiniteData<MyReviewPage>>(
          historyKey,
          (current) => {
            if (!current) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.filter(
                  (review) =>
                    review.id !== (result as { review_id: number }).review_id,
                ),
              })),
            };
          },
        );
      }

      if (sync) {
        // A response started before this mutation cannot acknowledge its revision.
        await queryClient.cancelQueries({
          queryKey: exploreBusinessDetailKey(businessId),
        });
      }

      if (!isCurrent()) return;

      await Promise.all([
        ...(sync
          ? [
              queryClient.invalidateQueries({
                queryKey: ACTIVITY_TIMELINE_QUERY_KEY,
              }),
            ]
          : []),
        ...(sync && context.authorUserId !== null
          ? [
              queryClient.invalidateQueries({
                queryKey: myReviewsKey(context.authorUserId),
              }),
            ]
          : []),
        queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: exploreBusinessDetailKey(businessId),
        }),
        ...(refreshCommunity
          ? [
              queryClient.invalidateQueries({
                queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
              }),
            ]
          : []),
      ]);

      if (!isCurrent()) return;

      if (sync === "create" || sync === "delete") {
        await invalidateBusinessCardCollections(queryClient);
      }

      if (!isCurrent()) return;

      if (
        sync === "create" &&
        (result as ReviewCreateResult).status === "published"
      ) {
        startSentimentSync({
          reviewId: (result as ReviewCreateResult).id,
          reviewText: (variables as { text: string }).text.trim(),
          baselineComputedAt: context.baselineSentimentComputedAt,
          baselineGeneratedAt: context.baselineGeneratedAt,
          baselineInsightsUpdatedAt: context.baselineInsightsUpdatedAt,
          baselineInsightsState: context.baselineInsightsState,
          baselineRequestedRevision: context.baselineRequestedRevision,
          baselineDataUpdateCount: context.baselineDataUpdateCount,
          startedAt: context.startedAt,
        });
      }

      if (
        sync === "update" &&
        (result as BusinessReview).status === "published" &&
        (variables as { textChanged: boolean }).textChanged
      ) {
        startSentimentSync({
          reviewId: (variables as { reviewId: number }).reviewId,
          reviewText: (result as BusinessReview).text,
          minimumReviewUpdatedAt: (result as BusinessReview).updated_at,
          baselineComputedAt: context.baselineSentimentComputedAt,
          baselineGeneratedAt: context.baselineGeneratedAt,
          baselineInsightsUpdatedAt: context.baselineInsightsUpdatedAt,
          baselineInsightsState: context.baselineInsightsState,
          baselineRequestedRevision: context.baselineRequestedRevision,
          baselineDataUpdateCount: context.baselineDataUpdateCount,
          startedAt: context.startedAt,
        });
      }

      if (sync === "delete") {
        startGeneratedInsightsSync({
          requiresPostMutationUpdate: true,
          baselineGeneratedAt: context.baselineGeneratedAt,
          baselineUpdatedAt: context.baselineInsightsUpdatedAt,
          baselineState: context.baselineInsightsState,
          baselineRequestedRevision: context.baselineRequestedRevision,
          baselineDataUpdateCount: context.baselineDataUpdateCount,
          resultNotBefore: context.startedAt,
          startedAt: context.startedAt,
        });
      }
    },
    onError: (error, _variables, context) => {
      if (sync !== "create" || !context) return;
      settleReviewSubmission(
        context.operationToken,
        undefined,
        isUncertainReviewOutcome(error),
      );
      if (isCurrentReviewSession(context.authorUserId, context.generation)) {
        // Reuse the existing private read path. Never automatically resubmit.
        void queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        });
        if (context.authorUserId !== null) {
          void queryClient.invalidateQueries({
            queryKey: myReviewsKey(context.authorUserId),
          });
        }
      }
    },
    onSettled: (_result, _error, variables, context) => {
      if (sync !== "update" || !context) return;
      const reviewId = (variables as { reviewId: number }).reviewId;
      useReviewWorkflowStore.setState((current) => {
        if (current.edits[reviewId] !== context.operationToken) return current;
        const edits = { ...current.edits };
        delete edits[reviewId];
        return { edits };
      });
      if (
        isCurrentReviewSession(context.authorUserId, context.generation) &&
        latestOperations.get(queryClient)?.get(context.operationKey) !==
          context.operationToken
      ) {
        void queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        });
        void queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        });
        if (context.authorUserId !== null) {
          void queryClient.invalidateQueries({
            queryKey: myReviewsKey(context.authorUserId),
          });
        }
      }
    },
  });
}

/** Retrieves the review preview shown on the business profile. */
export function useBusinessReviewPreview(businessId: number) {
  const userId = useAuthStore((state) => state.user?.id);
  const submissions = useAuthorReviewSubmissions(businessId);
  const query = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: async (): Promise<BusinessReviewPreview> => {
      const generation = getAuthSessionGeneration();
      const ownerId = useAuthStore.getState().user?.id;
      const response = await reviewService.getBusinessReviewPreview(businessId);
      if (
        getAuthSessionGeneration() !== generation ||
        useAuthStore.getState().user?.id !== ownerId
      )
        throw new Error("Review session changed.");
      return throwOnApiError(response);
    },
    enabled: Boolean(businessId),
  });

  const reviews = query.data?.reviews ?? [];
  const userReview =
    query.data?.user_review?.author?.id !== userId
      ? null
      : (query.data?.user_review ?? null);

  return {
    reviews,
    totalCount: query.error ? null : (query.data?.total_count ?? 0),
    userReview,
    hasOwnReview: Boolean(userReview) || submissions.length > 0,
    submission: submissions[0] ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Loads filtered review pages in the backend's stable order. */
export function useBusinessReviews(
  businessId: number,
  filters?: BusinessReviewFilters,
) {
  const query = useInfiniteQuery({
    queryKey: filters
      ? filteredBusinessReviewsKey(businessId, filters)
      : businessReviewsKey(businessId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<BusinessReviewListResponse> =>
      throwOnApiError(
        await reviewService.getAllBusinessReviews(
          businessId,
          filters,
          pageParam,
        ),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    isPlaceholderData: query.isPlaceholderData,

    isInitialLoading: query.isLoading && !query.isFetched,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,

    error: query.error,
    refetch: query.refetch,
  };
}

/** Keeps merchant review management's existing complete collection available. */
export function useMerchantBusinessReviews(businessId: number) {
  const query = useQuery({
    queryKey: [...businessReviewsKey(businessId), "merchant-all"],
    queryFn: async (): Promise<{
      reviews: BusinessReview[];
      totalCount: number;
    }> => {
      const reviews: BusinessReview[] = [];
      let page = 1;
      let hasNext = true;
      let totalCount = 0;

      while (hasNext) {
        const result = throwOnApiError(
          await reviewService.getAllBusinessReviews(
            businessId,
            undefined,
            page,
            100,
          ),
        );

        reviews.push(...result.items);
        totalCount = result.pagination.total_items;
        hasNext = result.pagination.has_next;
        page += 1;
      }

      return { reviews, totalCount };
    },
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data?.reviews ?? [],
    totalCount: query.data?.totalCount ?? 0,
    isInitialLoading: query.isLoading && !query.isFetched,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateReview(businessId: number) {
  return useReviewMutation<
    {
      text: string;
      photos: LocalReviewPhoto[];
      showInCommunity?: boolean;
      businessName?: string;
    },
    ReviewCreateResult
  >(
    businessId,
    ({ text, photos, showInCommunity }) =>
      reviewService.createReview(businessId, text, photos, showInCommunity),
    "create",
    true,
  );
}

export function useUpdateReview(businessId: number) {
  return useReviewMutation<
    {
      reviewId: number;
      text?: string;
      photos: LocalReviewPhoto[];
      keepPhotoIds?: number[];
      showInCommunity?: boolean;
      textChanged: boolean;
    },
    BusinessReview
  >(
    businessId,
    ({
      reviewId,
      text,
      photos,
      keepPhotoIds,
      showInCommunity,
      textChanged: _textChanged,
    }) =>
      reviewService.updateReview(
        reviewId,
        text,
        photos,
        keepPhotoIds,
        showInCommunity,
      ),
    "update",
    true,
  );
}

export function useDeleteReview(businessId: number) {
  return useReviewMutation<{ reviewId: number }, { review_id: number }>(
    businessId,
    ({ reviewId }: { reviewId: number }) =>
      reviewService.deleteReview(reviewId),
    "delete",
    true,
  );
}

export function useDeleteReviewPhoto(businessId: number) {
  return useReviewMutation(
    businessId,
    ({ photoId }: { photoId: number }) =>
      reviewService.deleteReviewPhoto(photoId),
    undefined,
    true,
  );
}

export function useReportReview(businessId: number) {
  return useReviewMutation(
    businessId,
    ({
      reviewId,
      reportType,
      explanation,
    }: {
      reviewId: number;
      reportType: ReviewReportReason;
      explanation?: string;
    }) => reviewService.reportReview(reviewId, reportType, explanation),
  );
}

export function useMyReviewReport(reviewId: number, enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: ["my-review-report", userId, reviewId],
    queryFn: async (): Promise<MyReviewReport> =>
      throwOnApiError(await reviewService.getMyReviewReport(reviewId)),
    enabled: enabled && Boolean(userId) && Boolean(reviewId),
  });
}
