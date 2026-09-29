import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createAdmin } from "../services/userManagementService";
import { invalidateAdminUserLists } from "./adminInvitationQueryEffects";

export default function useCreateAdmin() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => invalidateAdminUserLists(queryClient),
  });

  return {
    createAdmin: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}
