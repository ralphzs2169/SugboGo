import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchUsers } from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

export default function useUsers(params = {}, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: userQueryKeys.list(params),
    queryFn: () => fetchUsers(params),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    users: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
