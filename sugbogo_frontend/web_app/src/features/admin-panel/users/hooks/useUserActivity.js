import { useQuery } from "@tanstack/react-query";

import { fetchUserActivity } from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

export default function useUserActivity(
  userId,
  params = {},
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: userQueryKeys.activity(userId, params),
    queryFn: () => fetchUserActivity(userId, params),
    enabled: enabled && Boolean(userId),
  });

  return {
    activities: query.data ?? [],
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
