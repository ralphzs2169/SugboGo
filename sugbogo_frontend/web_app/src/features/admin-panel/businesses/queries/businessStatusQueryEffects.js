import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { businessOverviewQueryKey } from "./businessOverviewQuery";
import { businessStatusKeys } from "./businessStatusQuery";
import { notifyBusinessChanged } from "./businessResourceEvents";
import { adminBusinessUpdateRequestKeys } from "../../business-update-requests/hooks/businessUpdateRequestQueryKeys";
import { adminClassificationUpdateRequestKeys } from "../../business-update-requests/hooks/classificationUpdateRequestQueryKeys";
import { adminLocationUpdateRequestKeys } from "../../business-update-requests/hooks/locationUpdateRequestQueryKeys";

/** Refresh both React Query resources and mounted legacy business consumers. */
export function refreshBusinessStatusResources(queryClient, businessId) {
  return Promise.all([
    notifyBusinessChanged(businessId, queryClient),
    queryClient.invalidateQueries({ queryKey: businessOverviewQueryKey }),
    queryClient.invalidateQueries({
      queryKey: businessStatusKeys.status(businessId),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({ queryKey: businessStatusKeys.history(businessId) }),
    invalidateDashboardDecision(queryClient, { publication: true }),
    queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] }),
    queryClient.invalidateQueries({ queryKey: adminBusinessUpdateRequestKeys.all }),
    queryClient.invalidateQueries({ queryKey: adminClassificationUpdateRequestKeys.all }),
    queryClient.invalidateQueries({ queryKey: adminLocationUpdateRequestKeys.all }),
  ]);
}
