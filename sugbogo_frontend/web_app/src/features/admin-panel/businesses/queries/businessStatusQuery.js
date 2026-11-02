import { fetchBusinessStatus } from "../services/businessService";

export const businessStatusKeys = {
  status: (id) => ["admin", "businesses", "status", String(id)],
  history: (id) => ["admin", "businesses", "status-history", String(id)],
};

/** A newly opened confirmation always verifies the server, including cached rows. */
export function businessStatusQueryOptions(id) {
  return {
    queryKey: businessStatusKeys.status(id),
    queryFn: ({ signal }) => fetchBusinessStatus(id, { signal }),
    enabled: id != null,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  };
}
