import { useState } from "react";
import { createCategory } from "../services/clusterCategoryService";

export default function useCreateCategory() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values) {
    setIsSubmitting(true);

    try {
      return await createCategory(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    submit,
    isSubmitting,
  };
}
