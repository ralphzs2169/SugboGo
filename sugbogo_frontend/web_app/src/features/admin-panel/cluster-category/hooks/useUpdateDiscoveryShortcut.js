import { useState } from "react";
import { updateDiscoveryShortcut } from "../services/clusterCategoryService";

export default function useUpdateDiscoveryShortcut() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(shortcutId, values) {
    setIsSubmitting(true);

    try {
      return await updateDiscoveryShortcut(shortcutId, values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
