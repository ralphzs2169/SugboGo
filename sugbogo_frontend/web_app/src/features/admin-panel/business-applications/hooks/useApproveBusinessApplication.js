import { useState } from "react";

import { approveBusinessApplication } from "../services/businessApplicationService";

/**
 * Handles approval of a business application.
 *
 * Manages submission state and API errors while exposing a reusable
 * approval action for the application review workflow.
 */
export default function useApproveBusinessApplication() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function approveApplication(applicationId) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await approveBusinessApplication(applicationId);

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
