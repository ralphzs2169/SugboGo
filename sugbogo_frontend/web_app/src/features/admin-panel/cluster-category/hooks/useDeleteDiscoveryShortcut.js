import { useState } from "react";
import { deleteDiscoveryShortcut } from "../services/clusterCategoryService";

export default function useDeleteDiscoveryShortcut() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove(shortcutId) {
    setIsDeleting(true);

    try {
      return await deleteDiscoveryShortcut(shortcutId);
    } finally {
      setIsDeleting(false);
    }
  }

  return { remove, isDeleting };
}
