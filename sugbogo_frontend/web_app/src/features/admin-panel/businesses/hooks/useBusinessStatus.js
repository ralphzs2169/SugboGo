import { useQuery } from "@tanstack/react-query";
import { businessStatusQueryOptions } from "../queries/businessStatusQuery";

/** Own the required status request and expose its retry and freshness state. */
export default function useBusinessStatus(businessId) {
  return useQuery(businessStatusQueryOptions(businessId));
}
