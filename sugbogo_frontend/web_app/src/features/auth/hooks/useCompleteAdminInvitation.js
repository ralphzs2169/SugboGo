import { useMutation } from "@tanstack/react-query";

import { completeAdminInvitation } from "../api/auth.service";

export function useCompleteAdminInvitation() {
  const mutation = useMutation({
    mutationFn: completeAdminInvitation,
    retry: false,
  });

  return {
    completeInvitation: mutation.mutateAsync,
    isCompleting: mutation.isPending,
  };
}
