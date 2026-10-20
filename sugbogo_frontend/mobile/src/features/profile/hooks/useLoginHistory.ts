import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getLoginHistory } from "../api/loginHistory.service";

/** Loads account-scoped activity pages while preserving server ordering. */
export default function useLoginHistory() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: ["login-history", userId],
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const generation = getAuthSessionGeneration();
      const response = await getLoginHistory(pageParam);
      assertAuthSessionCurrent(generation);
      return throwOnApiError(response);
    },
    retry: false,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    staleTime: 0,
  });
  return {
    ...query,
    events: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}
