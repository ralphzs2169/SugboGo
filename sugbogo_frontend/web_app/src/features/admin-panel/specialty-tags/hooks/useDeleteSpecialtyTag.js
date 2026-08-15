import { useState } from "react";
import { deleteSpecialtyTag } from "../services/specialtyTagService";

/**
 * Handles specialty tag deletion.
 *
 * Manages the deletion loading state while allowing
 * API errors to propagate to the consuming component.
 */
export default function useDeleteSpecialtyTag() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(specialtyTagId) {
    setIsDeleting(true);

    try {
      return await deleteSpecialtyTag(specialtyTagId);
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    remove,
    isDeleting,
  };
}
