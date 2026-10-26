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

import * as service from "../../api/businessNameChange.service";
import type {
  BusinessNameChangeRequest,
  SubmitBusinessNameChangePayload,
} from "../../types/businessNameChange.types";
import { merchantBusinessNameChangeKeys } from "./businessNameChangeQueryKeys";
import { businessChangePendingStatusQueryKey } from "../change-requests/businessChangePendingStatusQueryKey";

/** Loads the merchant's paginated request history in backend order. */
export function useMerchantBusinessNameChangeRequests() {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useInfiniteQuery({
    queryKey: merchantBusinessNameChangeKeys.list(userId),
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(await service.getBusinessNameChangeRequests(pageParam)),
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
  useMerchantDecisionSync(requests, userId, "business_name", query.isSuccess);

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

/** Loads one merchant-owned request for its detail screen. */
export function useMerchantBusinessNameChangeRequest(requestId: number) {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: merchantBusinessNameChangeKeys.detail(userId, requestId),
    enabled: Boolean(userId && requestId),
    queryFn: async () =>
      throwOnApiError(await service.getBusinessNameChangeRequest(requestId)),
    refetchOnMount: "always",
  });
  useMerchantDecisionSync(
    query.data ? [query.data] : [],
    userId,
    "business_name",
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

/** Submits a proposal and refreshes only the request resource. */
export function useSubmitMerchantBusinessNameChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitBusinessNameChangePayload) =>
      throwOnApiError(await service.submitBusinessNameChange(payload)),
    onSuccess: async (changeRequest: BusinessNameChangeRequest) => {
      queryClient.setQueryData(
        merchantBusinessNameChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantBusinessNameChangeKeys.list(userId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: businessChangePendingStatusQueryKey(userId),
        }),
      ]);
    },
  });
}

/** Withdraws a pending request and refreshes its list and detail. */
export function useWithdrawMerchantBusinessNameChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: number) =>
      throwOnApiError(await service.withdrawBusinessNameChange(requestId)),
    onSuccess: async (changeRequest: BusinessNameChangeRequest) => {
      queryClient.setQueryData(
        merchantBusinessNameChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      if (userId)
        await syncMerchantDecision(
          queryClient,
          userId,
          "business_name",
          changeRequest,
        );
    },
  });
}
