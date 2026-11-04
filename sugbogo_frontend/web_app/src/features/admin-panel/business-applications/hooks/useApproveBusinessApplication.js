import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessOverviewQueryKey } from "../../businesses/queries/businessOverviewQuery";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { invalidateApplicationDecision } from "../queries/applicationQueryEffects";
import { approveBusinessApplication } from "../services/businessApplicationService";

/** Applies an application approve decision and refreshes the affected server resources. */
export default function useApproveBusinessApplication() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ applicationId, expectedSubmissionId }) =>
      approveBusinessApplication(applicationId, expectedSubmissionId),
    onSuccess: (_, { applicationId }) => Promise.all([
      invalidateApplicationDecision(queryClient, applicationId),
      invalidateDashboardDecision(queryClient, { roleComposition: true }),
      queryClient.invalidateQueries({
        queryKey: businessOverviewQueryKey,
        exact: true,
      }),
    ]),
  });

  return {
    approveApplication: (applicationId, expectedSubmissionId) =>
      mutation.mutateAsync({ applicationId, expectedSubmissionId }),
    isSubmitting: mutation.isPending,
    error: mutation.error,
  };
}
