import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getInstallationId } from "@/shared/api/storage.service";
import { DISCOVERY_FEED_QUERY_KEY } from "./useDiscoveryFeed";

import type {
  ExploreBusinessDetail,
  ExploreBusinessListResponse,
} from "../types/exploreBusiness.types";

type Props = {
  businessId: number;
};

type Variables = {
  tagId: number;
  isVouched: boolean;
};

/**
 * Manages business specialty vouch mutations with optimistic UI updates.
 *
 * Updates both the business detail and discovery feed caches immediately,
 * then synchronizes both caches with the server after the mutation settles.
 * Failed mutations roll back both cached states.
 */
export default function useBusinessVouch({ businessId }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ tagId, isVouched }: Variables) => {
      const response = isVouched
        ? await removeBusinessSpecialtyVouch(businessId, tagId)
        : await vouchForBusinessSpecialty(
            businessId,
            tagId,
            await getInstallationId(),
          );

      return throwOnApiError(response);
    },

    onMutate: async ({ tagId, isVouched }) => {
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
            specialty_tags: currentBusiness.specialty_tags.map((tag) => {
              if (tag.id !== tagId) {
                return tag;
              }

              return {
                ...tag,
                is_vouched: !isVouched,
                vouch_count: Math.max(
                  0,
                  tag.vouch_count + (isVouched ? -1 : 1),
                ),
              };
            }),
          };
        },
      );

      const updateVouchState = (
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
              specialty_tags: business.specialty_tags.map((tag) => {
                if (tag.id !== tagId) {
                  return tag;
                }

                return {
                  ...tag,
                  is_vouched: !isVouched,
                };
              }),
            };
          }),
        };
      };

      // Update both Explorer carousels optimistically.
      queryClient.setQueryData<ExploreBusinessListResponse>(
        newBusinessesQueryKey,
        updateVouchState,
      );
      queryClient.setQueryData<ExploreBusinessListResponse>(
        DISCOVERY_FEED_QUERY_KEY,
        updateVouchState,
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
    vouch: mutation.mutateAsync,
    pendingTagId: mutation.isPending
      ? (mutation.variables?.tagId ?? null)
      : null,
    error: mutation.error,
  };
}
