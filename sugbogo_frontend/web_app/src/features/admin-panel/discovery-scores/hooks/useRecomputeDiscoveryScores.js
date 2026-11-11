import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsQueryKeys } from "../../analytics/queries/analyticsQueryKeys";
import {
  discoveryScoreDetailKey,
  recomputeDiscoveryScores,
} from "../services/discoveryScoreService";

/** Refresh only Discovery Score caches after the synchronous operation completes. */
export default function useRecomputeDiscoveryScores() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshQueries = () => Promise.all([
    queryClient.invalidateQueries({
      queryKey: analyticsQueryKeys.discoveryScores({}).slice(0, 3),
    }),
    queryClient.invalidateQueries({ queryKey: discoveryScoreDetailKey }),
    queryClient.invalidateQueries({ queryKey: ["admin", "visibility-diagnostics"] }),
  ]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const summary = await recomputeDiscoveryScores();
      if (!["COMPLETED", "COMPLETED_WITH_FAILURES"].includes(summary?.status)) {
        throw new Error("The recomputation did not return a confirmed completion status.");
      }
      return summary;
    },
    onSuccess: refreshQueries,
  });

  async function refreshScores() {
    setIsRefreshing(true);
    try {
      await refreshQueries();
    } finally {
      setIsRefreshing(false);
    }
  }

  return { ...mutation, refreshScores, isRefreshing };
}
