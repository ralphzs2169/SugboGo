import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { businessOverviewQueryKey } from "../../businesses/queries/businessOverviewQuery";

import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { approveBusinessApplication } from "../services/businessApplicationService";

/**
 * Handles approval of a business application.
 *
 * Manages submission state and API errors while exposing a reusable
 * approval action for the application review workflow.
 */
export default function useApproveBusinessApplication() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function approveApplication(applicationId, expectedSubmissionId) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await approveBusinessApplication(
        applicationId,
        expectedSubmissionId,
      );

      await Promise.all([
        invalidateDashboardDecision(queryClient, { roleComposition: true }),
        queryClient.invalidateQueries({
          queryKey: businessOverviewQueryKey,
          exact: true,
        }),
      ]);

      return response;
    } catch (error) {
      console.error("Failed to approve business application:", error);

      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    approveApplication,
    isSubmitting,
    error,
  };
}
