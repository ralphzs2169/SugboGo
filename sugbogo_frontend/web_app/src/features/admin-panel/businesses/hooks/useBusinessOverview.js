import { useQuery } from "@tanstack/react-query";
import { businessOverviewQueryOptions } from "../queries/businessOverviewQuery";

/** Expose loading, retained data, errors, and targeted retry for the overview. */
export default function useBusinessOverview() {
  return useQuery(businessOverviewQueryOptions());
}
