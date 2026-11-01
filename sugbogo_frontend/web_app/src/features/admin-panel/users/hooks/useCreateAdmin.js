import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createAdmin } from "../services/userManagementService";
import { invalidateAdminUserLists } from "./adminInvitationQueryEffects";
import { dashboardQueryKeys } from "../../dashboard/queries/dashboardQueryKeys";

export default function useCreateAdmin() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => Promise.all([
      invalidateAdminUserLists(queryClient),
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.platformOverview,
        exact: true,
      }),
    ]),
  });

  return {
    createAdmin: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}
