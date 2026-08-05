import { useState } from "react";
import { deleteSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag deletion.
 *
 * Manages the deletion loading state and normalizes
 * successful and failed deletion responses.
 */
export default function useDeleteSpecialtyTag() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(specialtyTagId) {
    setIsDeleting(true);

    try {
      const response = await deleteSpecialtyTag(specialtyTagId);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors,
      };
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    remove,
    isDeleting,
  };
}
