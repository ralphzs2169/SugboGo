import { useQuery } from "@tanstack/react-query";
import { taxonomyStatisticsOptions } from "../../taxonomy/queries/taxonomyQueries";

/** Expose taxonomy inventory and independent retry through the existing hook. */
export default function useClusterStatistics() {
  const query = useQuery(taxonomyStatisticsOptions("clusters"));
  return { ...query, statistics: query.data };
}
