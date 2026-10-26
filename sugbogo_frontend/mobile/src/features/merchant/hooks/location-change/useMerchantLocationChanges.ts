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

import * as service from "../../api/locationChange.service";
import type {
  LocationChangeRequest,
  SubmitLocationChangePayload,
} from "../../types/locationChange.types";
import { merchantLocationChangeKeys } from "./locationChangeQueryKeys";
import { businessChangePendingStatusQueryKey } from "../change-requests/businessChangePendingStatusQueryKey";

/** Loads paginated Location request history in the backend's newest-first order. */
export function useMerchantLocationChangeRequests() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: merchantLocationChangeKeys.list(userId),
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(await service.getLocationChangeRequests(pageParam)),
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
  useMerchantDecisionSync(requests, userId, "location", query.isSuccess);

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

/** Loads one merchant-owned Location request and observes its decision. */
export function useMerchantLocationChangeRequest(requestId: number) {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: merchantLocationChangeKeys.detail(userId, requestId),
    enabled: Boolean(userId && requestId),
    queryFn: async () =>
      throwOnApiError(await service.getLocationChangeRequest(requestId)),
    refetchOnMount: "always",
  });
  useMerchantDecisionSync(
    query.data ? [query.data] : [],
    userId,
    "location",
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

/** Submits a reviewed proposal without touching the live Business Profile. */
export function useSubmitMerchantLocationChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmitLocationChangePayload) =>
      throwOnApiError(await service.submitLocationChange(payload)),
    onSuccess: async (changeRequest: LocationChangeRequest) => {
      queryClient.setQueryData(
        merchantLocationChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantLocationChangeKeys.list(userId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: businessChangePendingStatusQueryKey(userId),
        }),
      ]);
    },
  });
}

/** Withdraws a pending proposal and refreshes only request state. */
export function useWithdrawMerchantLocationChange() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      throwOnApiError(await service.withdrawLocationChange(requestId)),
    onSuccess: async (changeRequest: LocationChangeRequest) => {
      queryClient.setQueryData(
        merchantLocationChangeKeys.detail(userId, changeRequest.id),
        changeRequest,
      );
      if (userId)
        await syncMerchantDecision(
          queryClient,
          userId,
          "location",
          changeRequest,
        );
    },
  });
}
