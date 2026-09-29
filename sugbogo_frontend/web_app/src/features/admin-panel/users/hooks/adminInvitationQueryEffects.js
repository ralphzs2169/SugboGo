import { userQueryKeys } from "./userQueryKeys.js";

export function invalidateAdminUserLists(queryClient) {
  return queryClient.invalidateQueries({
    queryKey: userQueryKeys.lists(),
  });
}
