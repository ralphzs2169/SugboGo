import { useEffect, useState } from "react";

import { getCurrentApplication } from "../../api/merchantApplication.service";

import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";

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
        /**
         * No application exists yet.
         *
         * This is an expected state for users who have not started
         * merchant registration, so it should not be treated as an error.
         */
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

    /**
     * Existing application found.
     *
     * Store the application details so screens can determine the
     * current registration progress and resume where the user left off.
     */
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
