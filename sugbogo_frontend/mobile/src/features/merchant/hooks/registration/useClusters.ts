import { useEffect, useState } from "react";

import { getClusters } from "../../api/merchantApplication.service";
import { ClusterOption } from "../../types/registration/registrationOption.types";
import { ApiError } from "@/shared/types/apiResponse.types";

export default function useClusters() {
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  async function loadClusters() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getClusters();

      if (!response.success) {
        setError(response);
        setClusters([]);
        return;
      }

      setClusters(response.data);
    } catch (error) {
      console.error("Failed to load clusters:", error);

      setError({
        success: false,
        message: "Failed to load clusters.",
        code: "UNKNOWN_ERROR",
      });

      setClusters([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadClusters();
  }, []);

  return {
    clusters,
    isLoading,
    error,
    refetch: loadClusters,
  };
}
