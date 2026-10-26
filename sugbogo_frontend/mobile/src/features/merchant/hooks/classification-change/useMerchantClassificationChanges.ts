import useMerchantDecisionSync, {
  syncMerchantDecision,
} from "../change-requests/useMerchantDecisionSync";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as service from "../../api/classificationChange.service";
import type {
  ClassificationChangeRequest,
  SubmitClassificationChangePayload,
} from "../../types/classificationChange.types";
import { merchantClassificationChangeKeys } from "./classificationChangeQueryKeys";
import { businessChangePendingStatusQueryKey } from "../change-requests/businessChangePendingStatusQueryKey";

/** Loads paginated classification requests in the backend's newest-first order. */
export function useMerchantClassificationChangeRequests() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: merchantClassificationChangeKeys.list(userId),
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(await service.getClassificationChangeRequests(pageParam)),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    refetchOnMount: "always",
  });
  const requests = query.data?.pages.flatMap((page) => page.items) ?? [];
  const totalRequests = query.data?.pages[0]?.pagination.total_items;
  const latestRequest = query.data?.pages[0]?.items[0];
  const eligibility = query.data?.pages[0]?.eligibility ?? null;
  const pendingRequest =
    requests.find(
      (request) => request.id === eligibility?.pending_request_id,
    ) ?? null;
  useMerchantDecisionSync(requests, userId, "classification", query.isSuccess);

  return {
    requests,
    totalRequests,
    latestRequest,
    eligibility,
    pendingRequest,
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Loads one merchant-owned classification request. */
export function useMerchantClassificationChangeRequest(requestId: number) {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: merchantClassificationChangeKeys.detail(userId, requestId),
    enabled: Boolean(userId && requestId),
    queryFn: async () =>
      throwOnApiError(await service.getClassificationChangeRequest(requestId)),
    refetchOnMount: "always",
  });
  useMerchantDecisionSync(
    query.data ? [query.data] : [],
    userId,
    "classification",
    query.isSuccess,
  );

  return {
    request: query.data ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Submits a classification proposal without changing live profile data. */
export function useSubmitMerchantClassificationChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmitClassificationChangePayload) =>
      throwOnApiError(await service.submitClassificationChange(payload)),
    onSuccess: async (changeRequest: ClassificationChangeRequest) => {
      queryClient.setQueryData(
        merchantClassificationChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantClassificationChangeKeys.list(userId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: businessChangePendingStatusQueryKey(userId),
        }),
      ]);
    },
  });
}

/** Withdraws a pending request and refreshes its authoritative request state. */
export function useWithdrawMerchantClassificationChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      throwOnApiError(await service.withdrawClassificationChange(requestId)),
    onSuccess: async (changeRequest: ClassificationChangeRequest) => {
      queryClient.setQueryData(
        merchantClassificationChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      if (userId)
        await syncMerchantDecision(
          queryClient,
          userId,
          "classification",
          changeRequest,
        );
    },
  });
}
