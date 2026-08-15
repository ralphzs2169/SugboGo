import { useState } from "react";
import { updateSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag updates.
 *
 * Manages the submission loading state while allowing
 * API errors to propagate to the consuming component.
 */
export default function useUpdateSpecialtyTag() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(tagId, payload) {
    setIsSubmitting(true);

    try {
      return await updateSpecialtyTag(tagId, payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
