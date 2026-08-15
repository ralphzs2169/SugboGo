import { useState } from "react";
import { updateCategory } from "../services/clusterCategoryService";

export default function useUpdateCategory() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(categoryId, payload) {
    setIsSubmitting(true);

    try {
      return await updateCategory(categoryId, payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
