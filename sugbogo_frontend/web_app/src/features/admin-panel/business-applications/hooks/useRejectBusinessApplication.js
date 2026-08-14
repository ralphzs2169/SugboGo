import { useState } from "react";

import { rejectBusinessApplication } from "../services/businessApplicationService";

/**
 * Handles rejection of a business application.
 *
 * Manages submission state and API errors while exposing a reusable
 * rejection action for the application review workflow.
 */
export default function useRejectBusinessApplication() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function rejectApplication(applicationId, feedback) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await rejectBusinessApplication(applicationId, feedback);

      return response;
    } catch (error) {
      console.error("Failed to reject business application:", error);

      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    rejectApplication,
    isSubmitting,
    error,
  };
}
