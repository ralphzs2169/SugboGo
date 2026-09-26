import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchUserAdministrativeHistory } from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

export default function useUserAdministrativeHistory(
  userId,
  params = {},
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: userQueryKeys.history(userId, params),
    queryFn: () => fetchUserAdministrativeHistory(userId, params),
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
  });

  return {
    history: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
