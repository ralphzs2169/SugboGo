import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  StaleAuthSessionError,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getUserInterests } from "../../api/interest.service";
import { assertProfileSessionCurrent } from "../../utils/profileSession";

export const USER_INTERESTS_QUERY_KEY = ["user-interests"] as const;

/** Keeps private choices separate across accounts and replacement logins. */
export function userInterestsQueryKey(
  userId: number | null,
  generation: number,
) {
  return [...USER_INTERESTS_QUERY_KEY, userId, generation] as const;
}

/** Loads interests only for the current authenticated account session. */
export default function useUserInterests() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const isEnabled = (
    isAuthenticated &&
    userId !== null &&
    !isAuthLoading &&
    isAuthSessionCurrent(generation)
  );

  const query = useQuery({
    queryKey: userInterestsQueryKey(isEnabled ? userId : null, generation),
    enabled: isEnabled,
    queryFn: async () => {
      if (!isEnabled || useAuthStore.getState().isLoading) {
        throw new StaleAuthSessionError();
      }

      const session = { ownerId: userId ?? undefined, generation };
      assertProfileSessionCurrent(session);
      const response = await getUserInterests();
      assertProfileSessionCurrent(session);

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    data: isEnabled ? query.data : undefined,
    error: isEnabled ? query.error : null,
    userId,
    generation,
    isEnabled,
    isAuthLoading,
  };
}
