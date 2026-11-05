import { useQuery } from "@tanstack/react-query";
import { taxonomyStatisticsOptions } from "../../taxonomy/queries/taxonomyQueries";

/** Keep specialty inventory unavailable on failure while retaining successful reads. */
export default function useSpecialtyTagStatistics({ enabled = true } = {}) {
  const query = useQuery({
    ...taxonomyStatisticsOptions("specialty-tags"),
    enabled,
  });
  return {
    ...query,
    statistics: { totalTags: query.data?.total_tags },
  };
}
