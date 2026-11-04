import { adminApplicationKeys } from "./applicationQueryKeys";

/** Refresh authoritative application resources after a successful review decision. */
export function invalidateApplicationDecision(queryClient, applicationId) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminApplicationKeys.lists }),
    queryClient.invalidateQueries({
      queryKey: adminApplicationKeys.statistics,
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: adminApplicationKeys.detail(applicationId),
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: adminApplicationKeys.duplicates(applicationId),
      exact: true,
    }),
  ]);
}
