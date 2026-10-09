import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { MAP_PREVIEW_QUERY_KEY } from "@/features/explore/hooks/useMapPreviewBusinesses";
import { ROAD_ROUTE_QUERY_KEY } from "@/features/explore/hooks/useRoadRoute";
import { DIRECT_JOURNEYS_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneys";
import { DIRECT_JOURNEY_MAP_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneyMap";
import { getMerchantBusinessProfile } from "@/features/merchant/api/merchantBusinessProfile.service";
import { merchantBusinessProfileKey } from "@/features/merchant/hooks/business-profile/merchantBusinessProfileQueryKeys";
import type { MerchantBusinessProfileResponse } from "@/features/merchant/types/merchantBusinessProfile.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as service from "../../api/locationChange.service";
import type {
  LocationChangeRequest,
  SubmitLocationChangePayload,
} from "../../types/locationChange.types";
import { merchantLocationChangeKeys } from "./locationChangeQueryKeys";

const handledApprovals = new Set<string>();
const handlingApprovals = new Set<string>();

/** Refreshes only the live data affected by an observed approved location. */
function useRefreshApprovedLocation(
  request: LocationChangeRequest | undefined,
  userId: number | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || request?.status !== "approved") {
      return;
    }
    const approvalKey = `${userId}:${request.id}`;
    if (
      handledApprovals.has(approvalKey) ||
      handlingApprovals.has(approvalKey)
    ) {
      return;
    }
    handlingApprovals.add(approvalKey);

    async function refreshLiveLocation() {
      try {
        const profileKey = merchantBusinessProfileKey(userId);
        let profile =
          queryClient.getQueryData<MerchantBusinessProfileResponse>(profileKey);
        if (!profile) {
          profile = await queryClient.fetchQuery({
            queryKey: profileKey,
            queryFn: async () =>
              throwOnApiError(await getMerchantBusinessProfile()),
          });
        }
        if (!profile) {
          return;
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: profileKey }),
          queryClient.invalidateQueries({
            queryKey: exploreBusinessDetailKey(profile.id),
          }),
          queryClient.invalidateQueries({ queryKey: MAP_PREVIEW_QUERY_KEY }),
          queryClient.invalidateQueries({
            queryKey: [...ROAD_ROUTE_QUERY_KEY, profile.id],
          }),
          queryClient.invalidateQueries({
            queryKey: [...DIRECT_JOURNEYS_QUERY_KEY, profile.id],
          }),
          queryClient.invalidateQueries({
            queryKey: [...DIRECT_JOURNEY_MAP_QUERY_KEY, profile.id],
          }),
        ]);
        handledApprovals.add(approvalKey);
      } catch {
        // A later request observation can retry the targeted refresh.
      } finally {
        handlingApprovals.delete(approvalKey);
      }
    }

    void refreshLiveLocation();
  }, [request, queryClient, userId]);
}

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
  useRefreshApprovedLocation(latestRequest, userId);

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
  useRefreshApprovedLocation(query.data ?? undefined, userId);

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
      await queryClient.invalidateQueries({
        queryKey: merchantLocationChangeKeys.list(userId),
        refetchType: "all",
      });
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
      await queryClient.invalidateQueries({
        queryKey: merchantLocationChangeKeys.list(userId),
        refetchType: "all",
      });
    },
  });
}
