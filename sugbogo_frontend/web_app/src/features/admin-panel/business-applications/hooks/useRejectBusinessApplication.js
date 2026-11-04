import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { invalidateApplicationDecision } from "../queries/applicationQueryEffects";
import { rejectBusinessApplication } from "../services/businessApplicationService";

/** Applies an application reject decision and refreshes the affected server resources. */
export default function useRejectBusinessApplication() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ applicationId, payload }) =>
      rejectBusinessApplication(applicationId, payload),
    onSuccess: (_, { applicationId }) => Promise.all([
      invalidateApplicationDecision(queryClient, applicationId),
      invalidateDashboardDecision(queryClient),
    ]),
  });

  return {
    rejectApplication: (applicationId, payload) =>
      mutation.mutateAsync({ applicationId, payload }),
    isSubmitting: mutation.isPending,
    error: mutation.error,
  };
}
