import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reactivateBusiness, suspendBusiness } from "../services/businessService";
import { businessStatusKeys } from "../queries/businessStatusQuery";
import { refreshBusinessStatusResources } from "../queries/businessStatusQueryEffects";

/** Submit one explicit transition; conflicts and network failures never auto-retry. */
export default function useBusinessStatusTransition(businessId, operation) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      operation === "suspend"
        ? suspendBusiness(businessId, payload)
        : reactivateBusiness(businessId, payload),
    retry: false,
    onSuccess: (status) => {
      queryClient.setQueryData(businessStatusKeys.status(businessId), status);
      // A committed transition remains successful even if a subsequent refresh fails.
      void refreshBusinessStatusResources(queryClient, businessId);
    },
  });
}
