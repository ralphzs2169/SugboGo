import { useEffect, useRef } from "react";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { merchantBusinessProfileKey } from "@/features/merchant/hooks/business-profile/merchantBusinessProfileQueryKeys";
import type { MerchantBusinessProfileResponse } from "@/features/merchant/types/merchantBusinessProfile.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as service from "../../api/classificationChange.service";
import type {
  ClassificationChangeRequest,
  ClassificationChangeRequestPage,
  SubmitClassificationChangePayload,
} from "../../types/classificationChange.types";
import { merchantClassificationChangeKeys } from "./classificationChangeQueryKeys";

function useRefreshApprovedClassification(
  request: ClassificationChangeRequest | undefined,
  userId: number | undefined,
) {
  const queryClient = useQueryClient();
  const handledApprovalId = useRef<number | null>(null);

  useEffect(() => {
    if (
      !userId ||
      request?.status !== "approved" ||
      handledApprovalId.current === request.id
    ) {
      return;
    }

    const history = queryClient.getQueryData<
      InfiniteData<ClassificationChangeRequestPage>
    >(merchantClassificationChangeKeys.list(userId));
    const newestKnownRequest = history?.pages[0]?.items[0];
    if (newestKnownRequest && newestKnownRequest.id !== request.id) {
      return;
    }

    const profile = queryClient.getQueryData<MerchantBusinessProfileResponse>(
      merchantBusinessProfileKey(userId),
    );
    if (!profile) {
      return;
    }

    const currentTags = new Set(profile.specialty_tags.map((tag) => tag.id));
    const proposedTags = request.proposed.specialty_tags.map((tag) => tag.id);
    const alreadyCurrent =
      profile.category.id === request.proposed.category.id &&
      profile.cluster.id === request.proposed.cluster.id &&
      currentTags.size === proposedTags.length &&
      proposedTags.every((id) => currentTags.has(id));
    if (alreadyCurrent) {
      return;
    }

    handledApprovalId.current = request.id;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: merchantBusinessProfileKey(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: exploreBusinessDetailKey(profile.id),
      }),
    ]);
  }, [request, queryClient, userId]);
}

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
  const latestRequest = query.data?.pages[0]?.items[0];
  useRefreshApprovedClassification(latestRequest, userId);

  return {
    requests,
    latestRequest,
    pendingRequest: latestRequest?.status === "pending" ? latestRequest : null,
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
  useRefreshApprovedClassification(query.data ?? undefined, userId);

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
      await queryClient.invalidateQueries({
        queryKey: merchantClassificationChangeKeys.list(userId),
        refetchType: "all",
      });
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantClassificationChangeKeys.list(userId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: merchantClassificationChangeKeys.detail(
            userId,
            changeRequest.id,
          ),
        }),
      ]);
    },
  });
}
