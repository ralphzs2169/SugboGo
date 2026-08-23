import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getInstallationId } from "@/shared/api/storage.service";

import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";

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
 * The selected specialty updates immediately while only the specialty
 * currently being mutated is temporarily disabled. Failed mutations roll
 * back their optimistic changes, while the installation identifier is sent
 * with new vouches for abuse-detection purposes.
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
      const queryKey = ["explore-business-detail", businessId];

      await queryClient.cancelQueries({
        queryKey,
      });

      const previousBusiness =
        queryClient.getQueryData<ExploreBusinessDetail>(queryKey);

      queryClient.setQueryData<ExploreBusinessDetail>(
        queryKey,
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

      return {
        previousBusiness,
      };
    },

    onError: (_error, _variables, context) => {
      if (!context?.previousBusiness) {
        return;
      }

      queryClient.setQueryData(
        ["explore-business-detail", businessId],
        context.previousBusiness,
      );
    },

    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["explore-business-detail", businessId],
      });
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
