import { useMutation } from "@tanstack/react-query";

import { resendAdminInvitation } from "../services/userManagementService";

export default function useResendAdminInvitation() {
  const mutation = useMutation({
    mutationFn: resendAdminInvitation,
  });

  return {
    resendInvitation: mutation.mutateAsync,
    isResending: mutation.isPending,
    error: mutation.error,
  };
}
