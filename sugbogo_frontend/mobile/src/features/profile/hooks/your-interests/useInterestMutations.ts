import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  StaleAuthSessionError,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";

import {
  completeOnboardingInterests,
  updateUserInterests,
} from "../../api/interest.service";
import type { UserInterests } from "../../types/interest.types";
import {
  assertProfileSessionCurrent,
  captureProfileSession,
} from "../../utils/profileSession";
import { userInterestsQueryKey } from "./useUserInterests";

type InterestSubmission<TInput> = {
  input: TInput;
  session: ReturnType<typeof captureProfileSession>;
};

/** Applies private results and discovery refreshes only to the initiating session. */
function useOwnedInterestMutation<TInput>(
  request: (input: TInput) => Promise<ApiResponse<UserInterests>>,
) {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((state) => state.user?.id);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );

  const mutation = useMutation({
    mutationFn: async ({ input, session }: InterestSubmission<TInput>) => {
      assertProfileSessionCurrent(session);
      const response = await request(input);
      assertProfileSessionCurrent(session);
      return throwOnApiError(response);
    },
    onSuccess: async (interests, { session }) => {
      assertProfileSessionCurrent(session);
      const queryKey = userInterestsQueryKey(
        session.ownerId ?? null,
        session.generation,
      );

      await queryClient.cancelQueries({ queryKey, exact: true });
      assertProfileSessionCurrent(session);
      queryClient.setQueryData(queryKey, interests);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: RECOMMENDATIONS_QUERY_KEY,
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: [...EXPLORE_COLLECTIONS_QUERY_KEY, "interests"],
        }),
      ]);
      assertProfileSessionCurrent(session);
    },
  });

  async function mutateAsync(input: TInput) {
    const session = captureProfileSession();
    if (
      useAuthStore.getState().isLoading ||
      session.ownerId !== ownerId ||
      session.generation !== generation
    ) {
      throw new StaleAuthSessionError();
    }

    try {
      const interests = await mutation.mutateAsync({ input, session });
      assertProfileSessionCurrent(session);
      return interests;
    } catch (error) {
      assertProfileSessionCurrent(session);
      throw error;
    }
  }

  return {
    mutateAsync,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
  };
}

/** Persists onboarding specialty selections through the shared interest model. */
export function useCompleteOnboardingInterests() {
  return useOwnedInterestMutation(completeOnboardingInterests);
}

/** Saves a complete explicit-interest draft and refreshes recommendations. */
export function useUpdateUserInterests() {
  return useOwnedInterestMutation(updateUserInterests);
}
