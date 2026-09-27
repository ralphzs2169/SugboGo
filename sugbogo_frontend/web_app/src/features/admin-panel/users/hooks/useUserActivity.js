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
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
