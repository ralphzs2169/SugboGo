import { useQuery } from "@tanstack/react-query";

import { fetchClassificationClusterDisplay } from "../services/classificationUpdateRequestService";

/** Loads missing cluster icons without blocking classification review. */
export default function useClassificationClusterDisplay(request) {
  const clusters = [
    request?.previous?.cluster,
    request?.proposed?.cluster,
    request?.current?.cluster,
  ];
  const clusterIds = [
    ...new Set(
      clusters
        .filter((cluster) => cluster?.id != null && !cluster.icon)
        .map((cluster) => cluster.id),
    ),
  ].sort((first, second) => Number(first) - Number(second));

  const query = useQuery({
    queryKey: ["admin", "classification-cluster-display", clusterIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        clusterIds.map((clusterId) =>
          fetchClassificationClusterDisplay(clusterId),
        ),
      );

      return {
        metadata: Object.fromEntries(
          results.flatMap((result, index) =>
            result.status === "fulfilled"
              ? [[String(clusterIds[index]), result.value]]
              : [],
          ),
        ),
        unavailableCount: results.filter(
          (result) => result.status === "rejected",
        ).length,
      };
    },
    enabled: clusterIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    metadata: query.data?.metadata ?? {},
    unavailableCount: query.data?.unavailableCount ?? 0,
    refetch: query.refetch,
  };
}
