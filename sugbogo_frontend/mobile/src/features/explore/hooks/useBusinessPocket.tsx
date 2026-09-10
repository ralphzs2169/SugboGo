import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  pocketBusiness,
  removeBusinessFromPocket,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { DISCOVERY_FEED_QUERY_KEY } from "./useDiscoveryFeed";

import type {
  ExploreBusinessDetail,
  ExploreBusinessListResponse,
} from "../types/exploreBusiness.types";

type Props = {
  businessId: number;
};

type Variables = {
  isPocketed: boolean;
};

/**
 * Manages business pocket mutations with optimistic UI updates.
 *
 * The pocket state updates immediately across both the business detail
 * and discovery feed. Failed mutations restore both cached states, while
 * settled mutations synchronize the caches with the server.
 */
export default function useBusinessPocket({ businessId }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ isPocketed }: Variables) => {
      const response = isPocketed
        ? await removeBusinessFromPocket(businessId)
        : await pocketBusiness(businessId);

      return throwOnApiError(response);
    },

    onMutate: async ({ isPocketed }) => {
      const detailQueryKey = ["explore-business-detail", businessId];
      const newBusinessesQueryKey = ["explore-new-businesses"];

      await Promise.all([
        queryClient.cancelQueries({
          queryKey: detailQueryKey,
        }),
        queryClient.cancelQueries({
          queryKey: newBusinessesQueryKey,
        }),
        queryClient.cancelQueries({
          queryKey: DISCOVERY_FEED_QUERY_KEY,
        }),
      ]);

      const previousBusiness =
        queryClient.getQueryData<ExploreBusinessDetail>(detailQueryKey);

      const previousNewBusinesses =
        queryClient.getQueryData<ExploreBusinessListResponse>(
          newBusinessesQueryKey,
        );

      const previousDiscoveryFeed =
        queryClient.getQueryData<ExploreBusinessListResponse>(
          DISCOVERY_FEED_QUERY_KEY,
        );

      // Update business detail optimistically.
      queryClient.setQueryData<ExploreBusinessDetail>(
        detailQueryKey,
        (currentBusiness) => {
          if (!currentBusiness) {
            return currentBusiness;
          }

          return {
            ...currentBusiness,
            is_pocketed: !isPocketed,
          };
        },
      );

      const updatePocketState = (
        currentFeed: ExploreBusinessListResponse | undefined,
      ) => {
        if (!currentFeed) {
          return currentFeed;
        }

        return {
          ...currentFeed,
          items: currentFeed.items.map((business) => {
            if (business.id !== businessId) {
              return business;
            }

            return {
              ...business,
              is_pocketed: !isPocketed,
            };
          }),
        };
      };

      // Update both Explorer carousels optimistically.
      queryClient.setQueryData<ExploreBusinessListResponse>(
        newBusinessesQueryKey,
        updatePocketState,
      );
      queryClient.setQueryData<ExploreBusinessListResponse>(
        DISCOVERY_FEED_QUERY_KEY,
        updatePocketState,
      );

      return {
        previousBusiness,
        previousNewBusinesses,
        previousDiscoveryFeed,
      };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousBusiness) {
        queryClient.setQueryData(
          ["explore-business-detail", businessId],
          context.previousBusiness,
        );
      }

      if (context?.previousNewBusinesses) {
        queryClient.setQueryData(
          ["explore-new-businesses"],
          context.previousNewBusinesses,
        );
      }

      if (context?.previousDiscoveryFeed) {
        queryClient.setQueryData(
          DISCOVERY_FEED_QUERY_KEY,
          context.previousDiscoveryFeed,
        );
      }
    },

    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["explore-business-detail", businessId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["explore-new-businesses"],
        }),
        queryClient.invalidateQueries({
          queryKey: DISCOVERY_FEED_QUERY_KEY,
        }),
      ]);
    },
  });

  return {
    pocket: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
