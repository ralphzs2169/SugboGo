import { useQueries } from "@tanstack/react-query";

import { fetchUsers } from "../services/userManagementService";
import { userQueryKeys } from "./userQueryKeys";

const COUNT_FILTERS = [
  {},
  { status: "active" },
  { role: "merchant" },
  { status: "suspended" },
];

/** Loads independent account counts using the existing list cache and invalidation. */
export default function useUserOverview() {
  const queries = useQueries({
    queries: COUNT_FILTERS.map((filters) => {
      const params = {
        ...filters,
        page: 1,
        page_size: 1,
      };

      return {
        queryKey: userQueryKeys.list(params),
        queryFn: () => fetchUsers(params),
        select: (data) => data.pagination.total_items,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      };
    }),
  });

  return {
    total: queries[0],
    active: queries[1],
    merchants: queries[2],
    suspended: queries[3],
  };
}
