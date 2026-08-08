import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { MerchantApplicationStatus } from "@/shared/types/userInformation.types";

export default function useApplicationStatus() {
  const [status, setStatus] = useState<MerchantApplicationStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(false);

    try {
      const response = await getApplicationStatus();

      if (!response.success) {
        setError(true);
        return;
      }

      setStatus(response.data?.status ?? null);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus]),
  );

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}
