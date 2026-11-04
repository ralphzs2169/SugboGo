import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchBusinessApplications } from "../services/businessApplicationService";
import { adminApplicationKeys } from "../queries/applicationQueryKeys";

/** Loads the current application queue page while retaining rows during page changes. */
export default function useBusinessApplications(
  params = {},
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: adminApplicationKeys.list(params),
    queryFn: () => fetchBusinessApplications(params),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    applications: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
