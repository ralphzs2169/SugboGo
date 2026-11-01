import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { rejectBusinessApplication } from "../services/businessApplicationService";

/**
 * Handles rejection of a business application.
 *
 * Manages submission state and API errors while exposing a reusable
 * rejection action for the application review workflow.
 */
export default function useRejectBusinessApplication() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function rejectApplication(applicationId, payload) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await rejectBusinessApplication(applicationId, payload);

      await invalidateDashboardDecision(queryClient);

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
