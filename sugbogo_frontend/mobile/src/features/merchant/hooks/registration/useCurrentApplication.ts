import { useEffect, useState } from "react";

import { getCurrentApplication } from "../../api/merchantApplication.service";

import type { ApplicationDetailResponse } from "../../types/merchant-application/applicationApi.types";

/**
 * Fetches the authenticated user's current merchant application.
 *
 * Exposes the current application together with loading, error,
 * and refetch state for screens that need registration progress
 * or application status.
 */
export default function useCurrentApplication() {
  const [application, setApplication] =
    useState<ApplicationDetailResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState(false);

  const fetchApplication = async () => {
    setIsLoading(true);
    setError(false);

    const response = await getCurrentApplication();

    if (!response.success) {
      if (response.code === "APPLICATION_NOT_FOUND") {
        setApplication(null);
        setError(false);
        setIsLoading(false);
        return;
      }

      setApplication(null);
      setError(true);
      setIsLoading(false);
      return;
    }
    setApplication(response.data);
    setError(false);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchApplication();
  }, []);

  return {
    application,
    isLoading,
    error,
    refetch: fetchApplication,
  };
}
