import { useState } from "react";
import { createSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag creation.
 *
 * Manages the submission loading state and normalizes
 * successful and failed creation responses.
 */
export default function useCreateSpecialtyTag() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      const data = await createSpecialtyTag(values);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors ?? {},
      };
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
