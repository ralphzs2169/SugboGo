import { useState } from "react";
import { createSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag creation.
 *
 * Manages the submission loading state while allowing
 * API errors to propagate to the consuming component.
 */
export default function useCreateSpecialtyTag() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      return await createSpecialtyTag(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
