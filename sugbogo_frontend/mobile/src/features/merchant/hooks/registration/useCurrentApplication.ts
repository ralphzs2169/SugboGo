import { useCallback, useEffect, useState } from "react";

import { getCurrentApplication } from "../../api/merchantApplication.service";

import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";

export default function useCurrentApplication() {
  const [application, setApplication] =
    useState<ApplicationDetailResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState(false);

  const fetchApplication = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setError(false);

    try {
      const response = await getCurrentApplication();

      if (!response.success) {
        if (response.code === "APPLICATION_NOT_FOUND") {
          setApplication(null);
          setError(false);
          return;
        }

        if (showLoading) {
          setApplication(null);
          setError(true);
        }

        return;
      }

      setApplication(response.data);
      setError(false);
    } catch (error) {
      console.error("Failed to fetch current application:", error);

      if (showLoading) {
        setApplication(null);
        setError(true);
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  // Memoized so callers relying on identity (e.g. a useCallback/useEffect
  // dependency array) don't re-fire on every render.
  const refetch = useCallback(() => fetchApplication(true), [fetchApplication]);
  const refresh = useCallback(
    () => fetchApplication(false),
    [fetchApplication],
  );

  return {
    application,
    isLoading,
    error,
    refetch,
    refresh,
  };
}
