import { useQuery } from "@tanstack/react-query";
import isTerminalResourceError from "@/shared/utils/isTerminalResourceError";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getBusinessChangePendingStatus } from "../../api/businessChangePendingStatus.service";
import { businessChangePendingStatusQueryKey } from "./businessChangePendingStatusQueryKey";

/** Loads optional pending indicators without fetching request histories. */
export default function useBusinessChangePendingStatus() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: businessChangePendingStatusQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () =>
      throwOnApiError(await getBusinessChangePendingStatus()),
    refetchOnMount: "always",
  });

  return {
    pendingStatus: isTerminalResourceError(query.error)
      ? null
      : (query.data ?? null),
    hasData: query.data !== undefined && !isTerminalResourceError(query.error),
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
