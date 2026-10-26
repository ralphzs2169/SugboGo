import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { businessReviewsKey } from "@/features/explore/hooks/reviewQueryKeys";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as reviewDisputeService from "../../api/reviewDispute.service";
import type {
  LocalReviewDisputeEvidence,
  ReviewDisputeDetail,
  ReviewDisputeListResponse,
  ReviewDisputeReason,
} from "../../types/review-disputes/reviewDispute.types";
import { reviewDisputeKeys } from "./reviewDisputeQueryKeys";

/** Retrieves the merchant's review-dispute collection. */
export function useReviewDisputes(
  status: reviewDisputeService.ReviewDisputeFilter = "all",
) {
  const query = useInfiniteQuery({
    queryKey: reviewDisputeKeys.collection(status),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ReviewDisputeListResponse> =>
      throwOnApiError(
        await reviewDisputeService.getReviewDisputes(pageParam, status),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });

  return {
    disputes: query.data?.pages.flatMap((page) => page.items) ?? [],
    hasData: query.data !== undefined,
    pagination: query.data?.pages[0]?.pagination ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Uses the server's filtered total without downloading the pending collection. */
export function usePendingReviewDisputeCount() {
  const query = useQuery({
    queryKey: reviewDisputeKeys.pendingCount(),
    queryFn: async () =>
      throwOnApiError(
        await reviewDisputeService.getReviewDisputes(1, "pending", 1),
      ),
  });
  return {
    count: query.data?.pagination.total_items,
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Retrieves one merchant-owned dispute with its previous attempts. */
export function useReviewDisputeDetail(disputeId: number) {
  const query = useQuery({
    queryKey: reviewDisputeKeys.detail(disputeId),
    queryFn: async (): Promise<ReviewDisputeDetail> =>
      throwOnApiError(await reviewDisputeService.getReviewDispute(disputeId)),
    enabled: Boolean(disputeId),
  });

  return {
    dispute: query.data ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Creates a dispute and refreshes its list and source review metadata. */
export function useCreateReviewDispute(businessId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reviewId,
      reason,
      description,
    }: {
      reviewId: number;
      reason: ReviewDisputeReason;
      description: string;
    }) =>
      throwOnApiError(
        await reviewDisputeService.createReviewDispute(
          reviewId,
          reason,
          description,
        ),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewDisputeKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
      ]);
    },
  });
}

/** Uploads one evidence item and refreshes the affected dispute views. */
export function useAddReviewDisputeEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      disputeId,
      evidence,
    }: {
      disputeId: number;
      evidence: LocalReviewDisputeEvidence;
    }) =>
      throwOnApiError(
        await reviewDisputeService.addReviewDisputeEvidence(
          disputeId,
          evidence,
        ),
      ),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewDisputeKeys.detail(variables.disputeId),
        }),
        queryClient.invalidateQueries({ queryKey: reviewDisputeKeys.list() }),
      ]);
    },
  });
}

/** Deletes pending evidence and refreshes the affected dispute views. */
export function useDeleteReviewDisputeEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      evidenceId,
    }: {
      disputeId: number;
      evidenceId: number;
    }) =>
      throwOnApiError(
        await reviewDisputeService.deleteReviewDisputeEvidence(evidenceId),
      ),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewDisputeKeys.detail(variables.disputeId),
        }),
        queryClient.invalidateQueries({ queryKey: reviewDisputeKeys.list() }),
      ]);
    },
  });
}

/** Withdraws a pending dispute and clears all pending-state caches. */
export function useWithdrawReviewDispute(businessId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ disputeId }: { disputeId: number }) =>
      throwOnApiError(
        await reviewDisputeService.withdrawReviewDispute(disputeId),
      ),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewDisputeKeys.detail(variables.disputeId),
        }),
        queryClient.invalidateQueries({ queryKey: reviewDisputeKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
      ]);
    },
  });
}
