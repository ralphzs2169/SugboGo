import { fetchBusinesses } from "../services/businessService";

export const businessListKeys = {
  all: ["admin", "businesses", "list"],
  list: (params) => [...businessListKeys.all, params],
};

/** Cache each directory result by its complete server-side criteria. */
export function businessListQueryOptions(params) {
  return {
    queryKey: businessListKeys.list(params),
    queryFn: ({ signal }) => fetchBusinesses(params, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  };
}
