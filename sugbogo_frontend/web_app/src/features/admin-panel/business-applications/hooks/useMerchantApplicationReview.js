import { useEffect, useState } from "react";
import { fetchBusinessApplication } from "../services/businessApplicationService";

/**
 * Fetches a single business application for administrative review.
 *
 * Manages the application's loading, error, and data states and
 * refetches when the application ID changes.
 */
export default function useMerchantApplicationReview(
  applicationId,
  { enabled = true } = {},
) {
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadBusinessApplication() {
    if (!applicationId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchBusinessApplication(applicationId);

      setApplication(response);
    } catch (error) {
      console.error("Failed to load business application:", error);

      setError(error);
      setApplication(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinessApplication();
  }, [applicationId, enabled]);

  return {
    application,
    isLoading,
    error,
    refetch: loadBusinessApplication,
  };
}
