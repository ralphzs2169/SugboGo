import { useMutation, useQueryClient } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";

import {
  completeOnboardingInterests,
  updateUserInterests,
} from "../../api/interest.service";
import type { UpdateInterestsPayload } from "../../types/interest.types";
import { USER_INTERESTS_QUERY_KEY } from "./useUserInterests";

/** Persists onboarding specialty selections through the shared interest model. */
export function useCompleteOnboardingInterests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (specialtyTagIds: number[]) => {
      const response = await completeOnboardingInterests(specialtyTagIds);

      return throwOnApiError(response);
    },
    onSuccess: (interests) => {
      queryClient.setQueryData(USER_INTERESTS_QUERY_KEY, interests);
      void queryClient.invalidateQueries({
        queryKey: RECOMMENDATIONS_QUERY_KEY,
      });
    },
  });
}

/** Saves a complete explicit-interest draft and refreshes recommendations. */
export function useUpdateUserInterests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateInterestsPayload) => {
      const response = await updateUserInterests(payload);

      return throwOnApiError(response);
    },
    onSuccess: (interests) => {
      queryClient.setQueryData(USER_INTERESTS_QUERY_KEY, interests);
      void queryClient.invalidateQueries({
        queryKey: RECOMMENDATIONS_QUERY_KEY,
      });
    },
  });
}
