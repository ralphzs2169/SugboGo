import { useState } from "react";
import { createDiscoveryShortcut } from "../services/clusterCategoryService";

export default function useCreateDiscoveryShortcut() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      return await createDiscoveryShortcut(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
