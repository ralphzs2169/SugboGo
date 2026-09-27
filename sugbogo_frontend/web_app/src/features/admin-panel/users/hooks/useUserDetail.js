import { useQuery } from "@tanstack/react-query";

import { fetchUser } from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

export default function useUserDetail(userId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: userQueryKeys.detail(userId),
    queryFn: () => fetchUser(userId),
    enabled: enabled && Boolean(userId),
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
