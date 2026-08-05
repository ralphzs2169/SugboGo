import { useState } from "react";
import { updateSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag updates.
 *
 * Manages the submission state and normalizes API
 * success and validation error responses.
 *
 */
export default function useUpdateSpecialtyTag() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(tagId, payload) {
    setIsSubmitting(true);

    try {
      const data = await updateSpecialtyTag(tagId, payload);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
        errors: error.response?.data?.errors || {},
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
